import { AutopilotEnv } from "../index";
import { sendAlert } from "./alerts";

/**
 * Drako AI Router v1.3 (Steel Perfect + Cost Optimizer)
 * Cloudflare Worker Implementation
 * Handles: Policy, Budget, Rate Limits, FSM Breaker, Secret Segregation, Audit, Cost Control.
 */

export interface AiRunPayload {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    taskType: string;
    mode: "fast" | "smart";
    hints?: Record<string, any>;
    metadata?: Record<string, any>;
}

// Internal Cost Table (Estimated USD per 1M input/output tokens blended)
// This avoids external pricing API calls.
const COST_ESTIMATES: Record<string, number> = {
    "cloudflare": 0.60, // Blended approximate per 1M tokens
    "openai": 5.00,
    "mock": 0.01
};

export async function handleAiRunRequest(request: Request, env: AutopilotEnv, ctx?: ExecutionContext): Promise<Response> {
    const startedAt = Date.now();

    // 1. Correlation ID: Steel Enforcement (UUID v4 lowercase)
    const rawCorrelationId = request.headers.get("x-drako-correlation-id")?.toLowerCase();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const correlationId = (rawCorrelationId && uuidRegex.test(rawCorrelationId))
        ? rawCorrelationId
        : crypto.randomUUID();

    const tenantId = request.headers.get("x-drako-tenant-id") || "system";
    const saasId = request.headers.get("x-drako-saas-id") || null;

    // Execution Context Variables (for Audit)
    let finalStatus = 200;
    let finalProvider = "none";
    let finalModel = "none";
    let finalError: string | null = null;
    let finalTokens = 0;
    let errorCode: string | null = null;
    let taskType = "unknown";

    // Cost Logic Meta
    let policyOverrideReason: string | null = null;

    try {
        // 0. Secret Segregation (Steel Perfect)
        const s1 = env.VERCEL_TO_WORKER_SECRET?.trim();
        const s2 = env.X_DRAKO_ORIGIN_SECRET?.trim();

        // Configuration Gate
        if (!s1 || !s2 || s1 === s2) {
            console.error("STEEL_CONFIG_ERROR_SECRETS_EQUAL: Secrets must be distinct and present.");
            finalStatus = 503;
            errorCode = "CONFIG_ERROR";
            finalError = "Secrets must be distinct";
            return new Response(JSON.stringify({
                error: "Secrets must be distinct",
                code: "CONFIG_ERROR",
                correlationId
            }), { status: 503 });
        }

        // Auth Check (Constant Time)
        const originHeader = request.headers.get("X-Drako-Origin-Secret") || "";
        const authHeader = request.headers.get("Authorization") || "";
        const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

        const isAuthorized = await safeCompare(bearerToken, s1) && await safeCompare(originHeader, s2);

        if (!isAuthorized) {
            finalStatus = 401;
            finalError = "UNAUTHORIZED";
            errorCode = "AUTH_FAILED";
            return new Response(JSON.stringify({ error: finalError, correlationId }), { status: finalStatus });
        }

        // Parse Body
        let body: AiRunPayload;
        try {
            const rawBody = await request.clone().text();
            body = JSON.parse(rawBody);
            taskType = body.taskType || "default";
        } catch (e) {
            finalStatus = 400;
            finalError = "INVALID_JSON";
            errorCode = "BAD_REQUEST";
            return new Response(JSON.stringify({ error: finalError, correlationId }), { status: finalStatus });
        }

        if (!body.messages || body.messages.length === 0) {
            finalStatus = 400;
            finalError = "MESSAGES_REQUIRED";
            errorCode = "BAD_REQUEST";
            return new Response(JSON.stringify({ error: finalError, correlationId }), { status: finalStatus });
        }

        const mode = body.mode || "fast";

        // 1. Rate Limit Check
        if (await checkRateLimit(env.DRACO_DB, tenantId, taskType)) {
            finalStatus = 429;
            finalError = "RATE_LIMIT_EXCEEDED";
            errorCode = "RATE_LIMIT";
            return new Response(JSON.stringify({ error: finalError, correlationId }), { status: finalStatus });
        }

        // 2. Cost Control & Budget Check (Cost Optimizer v1)
        const costPolicy = await getCostPolicy(env.DRACO_DB, tenantId, saasId);

        // HARD LIMIT CHECK
        if (costPolicy && costPolicy.current_cost_usd >= costPolicy.hard_limit_usd) {
            finalStatus = 402; // Payment Required
            finalError = "Quota exceeded (Hard Limit)";
            errorCode = "COST_HARD_LIMIT";
            if (ctx) ctx.waitUntil(sendAlert(env, { type: "AI_COST_HARD_BLOCK", tenantId, message: `Hard limit hit ($${costPolicy.hard_limit_usd})` }));
            return new Response(JSON.stringify({ error: finalError, code: errorCode, correlationId }), { status: finalStatus });
        }

        // 3. Resolve Policy (with Cost/SLA Overrides)
        let policy = await resolvePolicy(env.DRACO_DB, tenantId, saasId, taskType, mode);

        // SOFT LIMIT / SLA DOWNGRADE CHECK
        if (costPolicy) {
            const isSoftLimitBreached = costPolicy.current_cost_usd >= costPolicy.soft_limit_usd;
            const isLatencyDegraded = (costPolicy.degraded_until && new Date(costPolicy.degraded_until).getTime() > Date.now()) || false;

            if (isSoftLimitBreached) {
                policy = { provider: costPolicy.downgrade_provider, model: costPolicy.downgrade_model };
                policyOverrideReason = "SOFT_LIMIT_BREACH";
                if (ctx) ctx.waitUntil(sendAlert(env, { type: "AI_COST_SOFT_DOWNGRADE", tenantId, message: `Soft limit breach ($${costPolicy.soft_limit_usd}). Downgraded to ${policy.provider}/${policy.model}.` }));
            } else if (isLatencyDegraded) {
                policy = { provider: costPolicy.downgrade_provider, model: costPolicy.downgrade_model };
                policyOverrideReason = "LATENCY_SLA_BREACH";
                if (ctx) ctx.waitUntil(sendAlert(env, { type: "AI_LATENCY_DEGRADED", tenantId, message: `Latency SLA degraded. Downgraded to ${policy.provider}/${policy.model}.` }));
            }
        }

        finalProvider = policy.provider;
        finalModel = policy.model;

        // 4. Circuit Breaker Check (FSM)
        const breakerKey = `ai:${finalProvider}:${finalModel}`;
        if (await isCircuitBroken(env.DRACO_DB, breakerKey, correlationId)) {
            // Breaker is OPEN or HALF_OPEN taken by someone else
            if (finalProvider !== "cloudflare") {
                // Fallback attempt
                const fallback = await resolvePolicy(env.DRACO_DB, "system", null, "default", mode);
                // Execute Fallback
                const fbRes = await executeAiRun(env, body, fallback, { correlationId, tenantId, saasId, startedAt, taskType });

                // Capture fallback metrics
                finalStatus = fbRes.status;
                finalTokens = fbRes.tokensUsed;
                finalProvider = fbRes.provider; // Real used provider
                finalModel = fbRes.model;
                finalError = fbRes.error;
                errorCode = fbRes.errorCode;

                return fbRes.response;
            }

            finalStatus = 503;
            errorCode = "CIRCUIT_OPEN";
            finalError = "Service unavailable due to open circuit";
            return new Response(JSON.stringify({ error: "SERVICE_UNAVAILABLE", reason: "CIRCUIT_OPEN", correlationId }), { status: finalStatus });
        }

        // 5. Execute
        const runRes = await executeAiRun(env, body, policy, { correlationId, tenantId, saasId, startedAt, taskType });

        finalStatus = runRes.status;
        finalTokens = runRes.tokensUsed;
        finalProvider = runRes.provider;
        finalModel = runRes.model;
        finalError = runRes.error;
        errorCode = runRes.errorCode;

        // Latency SLA Check (Post-Execution)
        const latency = Date.now() - startedAt;
        if (costPolicy && latency > costPolicy.latency_sla_ms) {
            // Async strike update
            await recordLatencyStrike(env.DRACO_DB, costPolicy.id, costPolicy.latency_strikes);
        }

        return runRes.response;

    } catch (error: any) {
        finalStatus = 500;
        finalError = error.message;
        errorCode = "INTERNAL_ERROR";
        errorCode = "INTERNAL_ERROR";
        console.error("AI_ROUTER_ERROR", error);
        if (ctx) ctx.waitUntil(sendAlert(env, { type: "AI_ROUTER_ERROR", tenantId, message: `Internal Error: ${error.message}`, metadata: { error: error.stack } }));
        return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: finalError, correlationId }), { status: finalStatus });
    } finally {
        // Steel Audit: Audit EVERY request unconditionally (Success 200 included)
        // Using captured real metrics from execution or fallbacks
        const meta = policyOverrideReason ? { policy_override: policyOverrideReason } : undefined;

        // Calculate Cost increment for this request
        const costPerM = COST_ESTIMATES[finalProvider] || 0.50;
        const estCost = (finalTokens / 1_000_000) * costPerM;

        // Async Updates (Fire & Forget mostly, but we await for V1 safety)
        if (finalTokens > 0) {
            await updateUsageAndCost(env.DRACO_DB, tenantId, saasId, finalTokens, estCost);
        }

        // Logic Check: Ensure we have data even if execution crashed early?
        // Variables are initialized at top, so they should be safe.
        // If finalProvider is "none", it means we crashed before policy resolution.

        await auditRequest(env.DRACO_DB, {
            correlationId,
            tenantId,
            saasId,
            taskType,
            provider: finalProvider || "unknown",
            model: finalModel || "unknown",
            status: finalStatus,
            tokens_used: finalTokens || 0, // Real tokens or 0
            latency_ms: Date.now() - startedAt,
            error: finalError || undefined,
            error_code: errorCode || undefined,
            metadata: meta
        });
    }
}

// --- Helpers ---

// Steel Perfect: Constant Time Comparison
// Steel Perfect: Constant Time Comparison (Manual Node-free implementation)
async function safeCompare(a: string, b: string): Promise<boolean> {
    if (a.length !== b.length) return false;
    const enc = new TextEncoder();
    const bufA = enc.encode(a);
    const bufB = enc.encode(b);

    let result = 0;
    for (let i = 0; i < bufA.length; i++) {
        result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
}

// FSM Breaker Logic
async function isCircuitBroken(db: D1Database, key: string, correlationId: string): Promise<boolean> {
    const breaker = await db.prepare("SELECT state, opened_at, cooldown_until FROM ai_circuit_breakers WHERE key = ? LIMIT 1").bind(key).first<{ state: string, opened_at: string | null, cooldown_until: string | null }>();

    if (!breaker) return false; // CLOSED (implicit)

    if (breaker.state === "OPEN") {
        const cooldown = 300_000; // 5 mins default
        const openedAt = new Date(breaker.opened_at!).getTime();
        // If we had a cooldown_until column, use it, else calc
        const expiresAt = breaker.cooldown_until ? new Date(breaker.cooldown_until).getTime() : (openedAt + cooldown);

        if (Date.now() >= expiresAt) {
            // PROMOTION: OPEN -> HALF_OPEN
            // Atomic update to claim the half-open trial
            const res = await db.prepare("UPDATE ai_circuit_breakers SET state = 'HALF_OPEN', updated_at = ? WHERE key = ? AND state = 'OPEN' RETURNING state").bind(new Date().toISOString(), key).first();

            if (res) {
                // We successfully transitioned to HALF_OPEN, we are the probe.
                // Log transition
                await logBreakerTransition(db, key, "OPEN", "HALF_OPEN", "COOLDOWN_EXPIRED", correlationId);
                return false; // Not broken, allow this request
            }
            // If update failed, someone else grabbed it or verify logic re-checked.
            // Check state again? Or just assume still OPEN/HALF_OPEN locked.
            return true;
        }
        return true; // Still OPEN and cooling down
    }

    if (breaker.state === "HALF_OPEN") {
        // Enforce concurrency: Only 1 probe allowed.
        // If we see HALF_OPEN here, it means a probe is ALREADY in flight (started by the transitioner above).
        // So we should reject concurrent requests until that probe resolves.
        return true;
    }

    return false; // CLOSED
}

async function recordSuccess(db: D1Database, key: string, correlationId: string = "system") {
    // If HALF_OPEN -> CLOSED (Success reset)
    // If CLOSED -> Update stats
    const now = new Date().toISOString();

    // Upsert logic
    await db.batch([
        db.prepare(`
            INSERT INTO ai_circuit_breakers (key, state, failure_count, success_count, updated_at) 
            VALUES (?, 'CLOSED', 0, 1, ?)
            ON CONFLICT(key) DO UPDATE SET 
                state = CASE WHEN state = 'HALF_OPEN' THEN 'CLOSED' ELSE state END,
                failure_count = 0,
                success_count = success_count + 1,
                opened_at = CASE WHEN state = 'HALF_OPEN' THEN NULL ELSE opened_at END,
                updated_at = excluded.updated_at
        `).bind(key, now),
        // Just log successful probe if we were half open? Hard to target exactly in a batch without conditional logic.
        // We will assume "HALF_OPEN" to "CLOSED" transition is implicit by the UPDATE above.
    ]);
    // Note: We could select before update to log explicit transition, but for perf we rely on the state machine to be self-healing.
}

async function recordFailure(db: D1Database, key: string, error: string, correlationId: string) {
    const now = new Date().toISOString();
    const threshold = 10;
    const cooldownMs = 300_000;
    const cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();

    // Get current state to decide transition log
    const current = await db.prepare("SELECT state, failure_count FROM ai_circuit_breakers WHERE key = ?").bind(key).first<{ state: string, failure_count: number }>();
    const oldState = current?.state || "CLOSED";
    let newState = oldState;

    let nextFailures = (current?.failure_count || 0) + 1;

    // FSM TRANSITIONS
    if (oldState === "HALF_OPEN") {
        newState = "OPEN"; // Probe failed
    } else if (oldState === "CLOSED" && nextFailures >= threshold) {
        newState = "OPEN"; // Threshold reached
    }

    // DB Update
    if (newState === "OPEN" && oldState !== "OPEN") {
        await db.batch([
            db.prepare(`
                INSERT INTO ai_circuit_breakers (key, state, failure_count, opened_at, cooldown_until, last_error, updated_at)
                VALUES (?, 'OPEN', ?, ?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                    state = 'OPEN',
                    failure_count = ?,
                    opened_at = ?,
                    cooldown_until = ?,
                    last_error = ?,
                    updated_at = ?
            `).bind(key, nextFailures, now, cooldownUntil, error, now, nextFailures, now, cooldownUntil, error, now),
            db.prepare("INSERT INTO ai_breaker_logs (id, breaker_key, previous_state, new_state, reason, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(`err_${Date.now()}`, key, oldState, "OPEN", error, correlationId, now)
        ]);
    } else {
        // Just increment failure count
        await db.prepare(`
            INSERT INTO ai_circuit_breakers (key, state, failure_count, last_error, updated_at)
            VALUES (?, 'CLOSED', 1, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                failure_count = failure_count + 1,
                last_error = excluded.last_error,
                updated_at = excluded.updated_at
        `).bind(key, error, now).run();
    }
}

async function logBreakerTransition(db: D1Database, key: string, from: string, to: string, reason: string, correlationId: string) {
    await db.prepare("INSERT INTO ai_breaker_logs (id, breaker_key, previous_state, new_state, reason, correlation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(`log_${Date.now()}`, key, from, to, reason, correlationId, new Date().toISOString()).run();
}


// Execution Result Type
interface ExecutionResult {
    response: Response;
    status: number;
    tokensUsed: number;
    provider: string;
    model: string;
    error: string | null;
    errorCode: string | null;
}

async function executeAiRun(env: AutopilotEnv, body: AiRunPayload, policy: { provider: string, model: string }, context: { correlationId: string, tenantId: string, saasId: string | null, startedAt: number, taskType: string }): Promise<ExecutionResult> {
    const { provider, model } = policy;
    let content = "";
    let status = 200;
    let tokensUsed = 0;
    let error: string | null = null;
    let errorCode: string | null = null;

    try {
        if (provider === "mock") {
            content = `Mock response for ${context.correlationId}`;
            tokensUsed = 10;
        } else if (provider === "cloudflare") {
            const ai = env.AI as any;
            if (!ai?.run) throw new Error("CF_AI_NOT_AVAILABLE");

            const res = await ai.run(model, {
                messages: body.messages,
                stream: false
            });

            content = res.response || res.choices?.[0]?.message?.content || "";
            // Robust token extraction (allow null/0)
            tokensUsed = res.usage?.total_tokens ?? res.usage?.tokens ?? 0;

            await recordSuccess(env.DRACO_DB, `ai:${provider}:${model}`, context.correlationId);
        } else if (provider === "openai" || provider === "anthropic") {
            // Stub for Multi-Provider Ready
            // In V1.4 these are placeholders.
            status = 501; // Not Implemented / Not Active
            error = `Provider '${provider}' is not currently active in this environment.`;
            errorCode = "PROVIDER_NOT_ACTIVE";
        } else {
            throw new Error("EXTERNAL_PROVIDER_NOT_IMPLEMENTED");
        }
    } catch (e: any) {
        status = 500;
        error = e.message;
        errorCode = "EXECUTION_ERROR";
        await recordFailure(env.DRACO_DB, `ai:${provider}:${model}`, e.message, context.correlationId);
    }

    // Note: Usage update is now handled in handleAiRunRequest finally block with cost.

    const response = (status === 200)
        ? new Response(JSON.stringify({
            ok: true,
            content,
            provider,
            model,
            usage: { tokens: tokensUsed },
            correlationId: context.correlationId
        }), { headers: { "Content-Type": "application/json" } })
        : new Response(JSON.stringify({ error: "AI_EXECUTION_FAILED", message: error, correlationId: context.correlationId }), { status });

    return {
        response,
        status,
        tokensUsed,
        provider,
        model,
        error,
        errorCode
    };
}

async function checkRateLimit(db: D1Database, tenantId: string, taskType: string): Promise<boolean> {
    const key = `rl:${tenantId}:${taskType}`;
    const now = Math.floor(Date.now() / 60000);

    const res = await db.prepare(
        "INSERT INTO ai_rate_limit_buckets (key, window_start, count, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END, window_start = excluded.window_start, updated_at = excluded.updated_at RETURNING count"
    ).bind(key, now, new Date().toISOString()).first<{ count: number }>();

    const limit = 50;
    return (res?.count || 0) > limit;
}

// Replaced by getCostPolicy for Budget Check logic + Cost Logic
async function getCostPolicy(db: D1Database, tenantId: string, saasId: string | null): Promise<any> {
    // Try SaaS specific first, then Tenant default, then null
    // But schema logic: UNIQUE(tenant_id, saas_id). saas_id can be null (default).
    // So if saasId is provided, look for it. If not found, look for saasId=NULL.

    let query = "SELECT * FROM ai_cost_policies WHERE tenant_id = ? AND saas_id = ?";
    let policy = await db.prepare(query).bind(tenantId, saasId).first<any>();

    if (!policy && saasId) {
        // Fallback to tenant default
        policy = await db.prepare("SELECT * FROM ai_cost_policies WHERE tenant_id = ? AND saas_id IS NULL").bind(tenantId).first<any>();
    }

    return policy;
}

// Deprecated in favor of getCostPolicy check, but keeping for compatibility if needed.
// Actually logic moved to main handler.
async function checkBudget(db: D1Database, tenantId: string, saasId: string | null): Promise<boolean> {
    // Legacy counters check, can be removed or kept as secondary safeguard.
    // For now, let's keep it simple: Use Cost Policy primarily.
    return true;
}


async function resolvePolicy(db: D1Database, tenantId: string, saasId: string | null, taskType: string, mode: "fast" | "smart"): Promise<{ provider: string, model: string }> {
    const policies = await db.prepare(`
        SELECT provider, model FROM ai_provider_policies 
        WHERE (tenant_id = ? OR tenant_id = 'system') 
        AND (saas_id = ? OR saas_id IS NULL)
        AND (task_type = ? OR task_type = 'default')
        AND mode = ?
        AND is_active = 1
        ORDER BY CASE WHEN tenant_id = ? THEN 1 ELSE 0 END DESC, 
                 CASE WHEN saas_id = ? THEN 1 ELSE 0 END DESC,
                 CASE WHEN task_type = ? THEN 1 ELSE 0 END DESC,
                 priority DESC
        LIMIT 1
    `).bind(tenantId, saasId, taskType, mode, tenantId, saasId, taskType).first<{ provider: string, model: string }>();

    if (policies) return policies;

    return {
        provider: "cloudflare",
        model: mode === "fast" ? "@cf/meta/llama-3-8b-instruct" : "@cf/meta/llama-3.1-70b-instruct"
    };
}

async function auditRequest(db: D1Database, params: {
    correlationId: string,
    tenantId: string,
    saasId: string | null,
    taskType: string,
    provider: string,
    model: string,
    status: number,
    tokens_used?: number,
    latency_ms?: number,
    error?: string,
    error_code?: string
    metadata?: any
}) {
    try {
        await db.prepare(`
            INSERT INTO ai_request_audits (id, correlation_id, tenant_id, saas_id, task_type, provider, model, status, tokens_used, latency_ms, error_code, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            params.correlationId,
            params.tenantId,
            params.saasId,
            params.taskType,
            params.provider,
            params.model,
            params.status,
            params.tokens_used || 0,
            params.latency_ms || 0,
            params.error_code || null,
            new Date().toISOString()
        ).run();
    } catch (e: any) {
        console.error(`[AUDIT_ERROR] ${params.correlationId}: ${e.message}`);
    }
}


async function updateUsageAndCost(db: D1Database, tenantId: string, saasId: string | null, tokens: number, costEstimate: number) {
    const now = new Date();
    const monthKey = `${tenantId}:${now.getFullYear()}-${now.getMonth() + 1}`;

    // 1. Update Legacy Counters (Tokens)
    await db.prepare(`
        INSERT INTO ai_usage_counters (key, tokens_in, tokens_out, requests_count, updated_at)
        VALUES (?, 0, ?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET 
            tokens_out = tokens_out + excluded.tokens_out,
            requests_count = requests_count + 1,
            updated_at = excluded.updated_at
    `).bind(monthKey, tokens, now.toISOString()).run();

    // 2. Update Cost Policy Accumulator
    // We update BOTH the specific SaaS policy AND the Tenant Default policy if reachable?
    // For V1 simpler: Just update the policy that governs this request context.
    // If saasId is NULL, we update tenant default.
    // If saasId is passed, we update that specific policy.
    // (If user wants tenant-wide hard limit, we need recursive update, but let's stick to simple V1: per-policy limit).

    // We need to match the exact row.
    const targetSaasId = saasId || null;
    let query = "UPDATE ai_cost_policies SET current_cost_usd = current_cost_usd + ?, updated_at = ? WHERE tenant_id = ? AND saas_id = ?";
    if (targetSaasId === null) {
        query = "UPDATE ai_cost_policies SET current_cost_usd = current_cost_usd + ?, updated_at = ? WHERE tenant_id = ? AND saas_id IS NULL";
        await db.prepare(query).bind(costEstimate, now.toISOString(), tenantId).run();
    } else {
        await db.prepare(query).bind(costEstimate, now.toISOString(), tenantId, targetSaasId).run();
    }
}

async function recordLatencyStrike(db: D1Database, policyId: string, currentStrikes: number) {
    const newStrikes = currentStrikes + 1;
    const now = new Date();

    let updateQuery = "UPDATE ai_cost_policies SET latency_strikes = ?, updated_at = ? WHERE id = ?";
    let params: any[] = [newStrikes, now.toISOString(), policyId];

    if (newStrikes >= 3) {
        // Activate Auto-Downgrade for 10 minutes
        const degradedUntil = new Date(now.getTime() + 10 * 60000).toISOString();
        updateQuery = "UPDATE ai_cost_policies SET latency_strikes = 0, degraded_until = ?, updated_at = ? WHERE id = ?";
        params = [degradedUntil, now.toISOString(), policyId];
    }

    await db.prepare(updateQuery).bind(...params).run();
}
