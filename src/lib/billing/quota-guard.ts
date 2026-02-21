import { queryOne, run } from "@/lib/db";
import { getBehavior, type SubscriptionState } from "./state_machine";

export type QuotaCheckResult = {
    allowed: boolean;
    reason?: string;
    current?: number;
    limit?: number;
    statusCode?: number;
};

/**
 * Checks if a tenant is allowed to perform an action based on:
 * 1. Subscription Status (Fail Closed)
 * 2. Usage Quotas (Strict Limit)
 */
export async function checkQuota(params: {
    tenantId: string;
    saasSlug: string;
    quotaKey: string;
    increment?: number;
}): Promise<QuotaCheckResult> {
    const { tenantId, saasSlug, quotaKey, increment = 0 } = params;

    // 1. Check Subscription Status
    const sub = await queryOne<{ status: string }>(
        `SELECT status FROM saas_subscriptions WHERE tenant_id = ? AND saas_slug = ?`,
        tenantId,
        saasSlug
    );

    // Default to 'trial' if no subscription found (or 'canceled' if strict strict)
    // For safety, if no sub found -> BLOCKED (Fail Closed)
    if (!sub) {
        console.error(`Missing subscription for ${tenantId} on ${saasSlug}`);
        return { allowed: false, reason: "SUBSCRIPTION_MISSING", statusCode: 403 };
    }

    const behavior = getBehavior(sub.status);

    // Hard block on unpaid/canceled for ALL generic features
    // Specific checks can inspect behavior.mode
    if (behavior.mode === 'blocked' || behavior.mode === 'read-only') {
        // Exception: read-only might allow GETs, but this guard is usually for Actions/Mutations
        // We will assume checkQuota is for resource consumption (Action)
        return { allowed: false, reason: `SUBSCRIPTION_${sub.status.toUpperCase()}`, statusCode: 402 };
    }

    // 2. Check Usage Quota
    const quota = await queryOne<{ current_value: number; limit_value: number }>(
        `SELECT current_value, limit_value 
     FROM saas_usage_quotas 
     WHERE tenant_id = ? AND saas_slug = ? AND quota_key = ?`,
        tenantId,
        saasSlug,
        quotaKey
    );

    if (!quota) {
        // If quota row missing, it implies unlimited OR error. 
        // Secure default: unlimited ? No, Secure default is 0. 
        // But commonly this means "not initialized".
        // We will assume 0 limit if missing to fail closed.
        return { allowed: false, reason: "QUOTA_NOT_INITIALIZED", statusCode: 403 };
    }

    const { current_value, limit_value } = quota;

    if (limit_value === -1) {
        return { allowed: true, current: current_value, limit: -1 };
    }

    if (current_value + increment > limit_value) {
        return {
            allowed: false,
            reason: "QUOTA_EXCEEDED",
            current: current_value,
            limit: limit_value,
            statusCode: 429
        };
    }

    return { allowed: true, current: current_value, limit: limit_value };
}

/**
 * Atomically increments usage.
 * Should be called AFTER action success, or as a reservation.
 */
export async function incrementQuota(params: {
    tenantId: string;
    saasSlug: string;
    quotaKey: string;
    amount: number;
}): Promise<void> {
    const { tenantId, saasSlug, quotaKey, amount } = params;

    await run(
        `UPDATE saas_usage_quotas 
     SET current_value = current_value + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE tenant_id = ? AND saas_slug = ? AND quota_key = ?`,
        amount,
        tenantId,
        saasSlug,
        quotaKey
    );
}
