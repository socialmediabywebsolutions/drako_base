
import { DurableObject } from "cloudflare:workers";

interface RateLimitState {
    tokens: number;
    lastRefill: number;
}

interface RateLimitConfig {
    capacity: number;
    refillRate: number; // tokens per second
    window: number; // seconds
}

// Windows: 10s (Burst), 60s (Sustained), 15m (Long-term)
const WINDOWS: Record<string, RateLimitConfig> = {
    "10s": { capacity: 20, refillRate: 2, window: 10 },    // ~2 req/s sustained, 20 burst
    "60s": { capacity: 100, refillRate: 1.6, window: 60 }, // ~100 req/min
    "15m": { capacity: 1000, refillRate: 1.1, window: 900 } // ~1000 req/15m
};

export class RateLimiterDO extends DurableObject {
    private storage: DurableObjectStorage;
    private state: Map<string, RateLimitState>; // In-memory cache
    private nonces: Set<string>;

    constructor(ctx: DurableObjectState, env: any) {
        super(ctx, env);
        this.storage = ctx.storage;
        this.state = new Map();
        this.nonces = new Set();
    }

    async alarm() {
        // Cleanup old nonces
        // In a real implementation with timestamps, we'd delete only expired.
        // Since we blindly stored `true`, we clear ALL.
        // This is safe ONLY if the Alarm period > Replay Window.
        // Replay Window = 60s. Alarm = 1 hour. Safe.
        // But invalid nonces (replays) appearing exactly at the cleanup boundary might get through if resent?
        // No, because timestamp would be expired ( > 60s).
        // So clearing execution is safe.
        const list = await this.storage.list({ prefix: "nonce:" });
        await this.storage.delete(Array.from(list.keys()));
        this.nonces.clear();
    }

    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        // Internal API Route: /check
        if (url.pathname === "/check") {
            const keys = url.searchParams.getAll("key"); // e.g. tenant:10s, tenant:60s
            if (keys.length === 0) return new Response("Missing keys", { status: 400 });

            let allowed = true;
            let reason = "";

            // Check all requested keys (windows)
            for (const key of keys) {
                // Parse key to find window type (naive convention: ends with :10s, :60s, etc)
                // Expected format: {prefix}:{window} e.g. tenant_123:60s
                const windowType = Object.keys(WINDOWS).find(w => key.endsWith(`:${w}`));
                const config = windowType ? WINDOWS[windowType] : WINDOWS["10s"]; // Default to strict if unknown

                const status = await this.checkLimit(key, config);
                if (!status.allowed) {
                    allowed = false;
                    reason = status.reason || `Limit exceeded: ${windowType}`;
                    break; // Fail closed on first violation
                }
            }

            return new Response(JSON.stringify({ allowed, reason }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // Security Route: /check-nonce
        // Params: ?nonce=...
        if (url.pathname === "/check-nonce") {
            const nonce = url.searchParams.get("nonce");
            if (!nonce) return new Response("Missing nonce", { status: 400 });

            // 1. Check Memory
            if (this.nonces.has(nonce)) {
                return new Response(JSON.stringify({ allowed: false, reason: "Replay detected" }), { status: 409 });
            }

            // 2. Check Storage (Double check for zombie restarts)
            const exists = await this.storage.get<boolean>(`nonce:${nonce}`);
            if (exists) {
                this.nonces.add(nonce); // Sync memory
                return new Response(JSON.stringify({ allowed: false, reason: "Replay detected" }), { status: 409 });
            }

            // 3. Store (Expire in 90s to be safe for 60s window)
            // We use a simplified approach: Store, and let a separate alarm clean up? 
            // Or just store. KV/Durable Storage is cheap-ish.
            // Be better: Set Alarm for cleanup? Or just rely on LRU if we had one.
            // For Phase 3.1: Just store.
            this.nonces.add(nonce);
            await this.storage.put(`nonce:${nonce}`, true);

            // Cleanup Logic (lazy)
            // In a real high-volume system, we'd use a rolling window or Alarm.
            // Here, we just set a timeout to delete from memory? No, DO might die.
            // We'll set an Alarm to clear old nonces every hour? 
            // Better: 'put' with no expiration is bad.
            // Let's assume high traffic handles it or we accept growth for this phase.
            // *Hardening*: We SHOULD clean up. Use `setAlarm`.
            const currentAlarm = await this.storage.getAlarm();
            if (currentAlarm === null) {
                await this.storage.setAlarm(Date.now() + 60 * 60 * 1000); // 1 hour
            }

            return new Response(JSON.stringify({ allowed: true }), { status: 200 });
        }

        return new Response("Not Found", { status: 404 });
    }

    private async checkLimit(key: string, config: RateLimitConfig): Promise<{ allowed: boolean; reason?: string }> {
        let state = this.state.get(key);

        // Load from storage if not in memory (Warm-up)
        if (!state) {
            state = (await this.ctx.storage.get<RateLimitState>(key)) || { tokens: config.capacity, lastRefill: Date.now() };
            this.state.set(key, state);
        }

        const now = Date.now();
        const elapsed = (now - state.lastRefill) / 1000;

        // Refill logic
        if (elapsed > 0) {
            const refill = elapsed * config.refillRate;
            state.tokens = Math.min(config.capacity, state.tokens + refill);
            state.lastRefill = now;
        }

        if (state.tokens >= 1) {
            state.tokens -= 1;
            this.ctx.storage.put(key, state);
            return { allowed: true };
        }

        return { allowed: false, reason: 'Tokens exhausted' };
    }
}
