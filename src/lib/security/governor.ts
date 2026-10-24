import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { run, queryAll } from "@/lib/db";
import { generateCorrelationId } from "../correlation";

/**
 * Drako-Forge Steel v1.0.1 - AI Governance & Fair Usage
 */

export type BreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface GovernorConfig {
    maxTokensMonthly: number;
    softLimitThreshold: number; // 0.0 to 1.0 (e.g. 0.8 for 80%)
    failureThreshold: number;
    cooldownMs: number;
}

const DEFAULT_CONFIG: GovernorConfig = {
    maxTokensMonthly: 1_000_000,
    softLimitThreshold: 0.8,
    failureThreshold: 5,
    cooldownMs: 300_000, // 5 minutes
};

/**
 * AI Governor: Manages budgets and circuit breakers with D1 persistence.
 */
export async function checkAiGovernance(params: {
    tenantId: string;
    breakerKey: string;
    config?: Partial<GovernorConfig>;
    correlationId?: string;
    envOverride?: DracoEnv | null;
}): Promise<{ allowed: boolean; reason?: string; warning?: boolean }> {
    const env = params.envOverride || resolveEnv();
    const config = { ...DEFAULT_CONFIG, ...params.config };
    const correlationId = params.correlationId || generateCorrelationId();
    const now = new Date();
    const monthKey = `${params.tenantId}:${now.getFullYear()}-${now.getMonth() + 1}`;

    // 1. Check Circuit Breaker
    const breaker = await getBreakerStatus(params.breakerKey, env);
    if (breaker.state === "OPEN") {
        const openedAt = breaker.opened_at ? new Date(breaker.opened_at).getTime() : 0;
        if (Date.now() - openedAt < config.cooldownMs) {
            return { allowed: false, reason: "AI_CIRCUIT_OPEN" };
        }
        // Transition to HALF_OPEN
        await updateBreakerState(params.breakerKey, "CLOSED", "HALF_OPEN", "COOLDOWN_EXPIRED", correlationId, env);
    }

    // 2. Check Monthly Budget
    const usage = await getMonthlyUsage(monthKey, env);
    const totalTokens = (usage.tokens_in || 0) + (usage.tokens_out || 0);

    if (totalTokens >= config.maxTokensMonthly) {
        return { allowed: false, reason: "AI_QUOTA_HARD_LIMIT" };
    }

    const isSoftLimitReached = totalTokens >= (config.maxTokensMonthly * config.softLimitThreshold);

    return {
        allowed: true,
        warning: isSoftLimitReached
    };
}

async function getBreakerStatus(key: string, env: DracoEnv | null) {
    if (!env?.DRACO_DB) return { state: "CLOSED" as BreakerState, opened_at: null };
    const rows = await queryAll<any>("SELECT state, opened_at FROM ai_circuit_breakers WHERE key = ? LIMIT 1", key);
    return rows[0] || { state: "CLOSED" as BreakerState, opened_at: null };
}

async function getMonthlyUsage(key: string, env: DracoEnv | null) {
    if (!env?.DRACO_DB) return { tokens_in: 0, tokens_out: 0 };
    const rows = await queryAll<any>("SELECT tokens_in, tokens_out FROM ai_usage_counters WHERE key = ? LIMIT 1", key);
    return rows[0] || { tokens_in: 0, tokens_out: 0 };
}

export async function recordAiSuccess(key: string, envOverride?: DracoEnv | null) {
    const env = envOverride || resolveEnv();
    if (!env?.DRACO_DB) return;
    await run(
        `UPDATE ai_circuit_breakers 
     SET failure_count = 0, success_count = success_count + 1, updated_at = ? 
     WHERE key = ?`,
        new Date().toISOString(),
        key
    );
}

export async function recordAiFailure(params: {
    breakerKey: string;
    error: string;
    correlationId: string;
    threshold: number;
    envOverride?: DracoEnv | null;
}) {
    const env = params.envOverride || resolveEnv();
    if (!env?.DRACO_DB) return;

    const now = new Date().toISOString();
    // Get current failure count
    const rows = await queryAll<any>("SELECT state, failure_count FROM ai_circuit_breakers WHERE key = ? LIMIT 1", params.breakerKey);
    const current = rows[0] || { state: "CLOSED", failure_count: 0 };

    const nextFailureCount = current.failure_count + 1;
    const shouldOpen = nextFailureCount >= params.threshold && current.state !== "OPEN";

    if (shouldOpen) {
        await updateBreakerState(params.breakerKey, current.state, "OPEN", params.error, params.correlationId, env);
    } else {
        await run(
            `INSERT INTO ai_circuit_breakers (key, state, failure_count, last_error, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET 
         failure_count = excluded.failure_count,
         last_error = excluded.last_error,
         updated_at = excluded.updated_at`,
            params.breakerKey,
            current.state,
            nextFailureCount,
            params.error,
            now
        );
    }
}

export async function recordAiUsage(params: {
    tenantId: string;
    tokensIn: number;
    tokensOut: number;
    envOverride?: DracoEnv | null;
}) {
    const env = params.envOverride || resolveEnv();
    if (!env?.DRACO_DB) return;

    const now = new Date();
    const monthKey = `${params.tenantId}:${now.getFullYear()}-${now.getMonth() + 1}`;
    const nowIso = now.toISOString();

    await run(
        `INSERT INTO ai_usage_counters (key, tokens_in, tokens_out, requests_count, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET 
       tokens_in = tokens_in + excluded.tokens_in,
       tokens_out = tokens_out + excluded.tokens_out,
       requests_count = requests_count + 1,
       updated_at = excluded.updated_at`,
        monthKey,
        params.tokensIn,
        params.tokensOut,
        nowIso
    );
}

async function updateBreakerState(
    key: string,
    previous: string,
    next: BreakerState,
    reason: string,
    correlationId: string,
    env: DracoEnv | null
) {
    if (!env?.DRACO_DB) return;
    const now = new Date().toISOString();

    await env.DRACO_DB.batch([
        env.DRACO_DB.prepare(
            `INSERT INTO ai_circuit_breakers (key, state, failure_count, opened_at, updated_at)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(key) DO UPDATE SET 
         state = excluded.state,
         failure_count = 0,
         opened_at = excluded.opened_at,
         updated_at = excluded.updated_at`
        ).bind(key, next, next === "OPEN" ? now : null, now),

        env.DRACO_DB.prepare(
            `INSERT INTO ai_breaker_logs (id, breaker_key, previous_state, new_state, reason, correlation_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(`log_${Date.now()}`, key, previous, next, reason, correlationId, now)
    ]);
}
