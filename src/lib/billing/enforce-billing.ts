
import { queryOne, run } from "@/lib/db";
import { resolveSaasContext, type SaasContext } from "@/lib/saas/resolve-saas-context";
import { type NextRequest } from "next/server";

export type BillingAction = "ai_calls" | "workspaces" | "storage_gb" | "users" | "feature_access";

export type EnforcementResult = {
    allowed: boolean;
    reason?: string;
    status: 402 | 403 | 429 | 200;
    remaining?: number;
};

// Helper: Require SaaS Context
export function requireSaasContext(req: NextRequest): { saasSlug: string; tenantId: string | null } {
    const ctx = resolveSaasContext(req);
    // Explicit header trust for internal calls / known domains
    const tenantId = req.headers.get("x-tenant-id") || null;

    if (!ctx) {
        // FAIL CLOSED
        throw new Error("SAAS_CONTEXT_MISSING");
    }
    return { saasSlug: ctx.slug, tenantId };
}

async function logDeniedAccess(saasSlug: string, tenantId: string, action: string, reason: string, correlationId: string) {
    try {
        await run(
            `INSERT INTO billing_audit_logs (id, saas_slug, tenant_id, event_type, severity, correlation_id, metadata_json)
             VALUES (?, ?, ?, 'access_denied', 'warning', ?, ?)`,
            `deny_${correlationId}`, saasSlug, tenantId, correlationId, JSON.stringify({ action, reason })
        );
    } catch (e) {
        console.error("Failed to log access denial", e);
    }
}

/**
 * FAIL-CLOSED BILLING GUARD
 */
export async function enforceBilling(
    saasSlug: string,
    tenantId: string,
    action: BillingAction,
    increment: number = 0,
    correlationId?: string
): Promise<EnforcementResult> {
    const cid = correlationId || `enf_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
        // 1. Check Subscription
        const sub = await queryOne<{ status: string }>(
            `SELECT status FROM saas_subscriptions WHERE saas_slug = ? AND tenant_id = ?`,
            saasSlug, tenantId
        );

        if (!sub) {
            // FAIL CLOSED (402) - No Subscription
            await logDeniedAccess(saasSlug, tenantId, action, "NO_SUBSCRIPTION", cid);
            return { allowed: false, reason: "NO_SUBSCRIPTION", status: 402 };
        }

        const { status } = sub;
        const allowedStatuses = ["active", "trial", "past_due"];

        if (!allowedStatuses.includes(status)) {
            await logDeniedAccess(saasSlug, tenantId, action, `SUBSCRIPTION_${status.toUpperCase()}`, cid);
            return { allowed: false, reason: `SUBSCRIPTION_${status.toUpperCase()}`, status: 402 };
        }

        // Special Rule: Past Due blocks 'workspaces' creation
        if (status === 'past_due' && (action === 'workspaces' || action === 'ai_calls')) {
            await logDeniedAccess(saasSlug, tenantId, action, `PAST_DUE_BLOCK`, cid);
            return { allowed: false, reason: `Payment Past Due. Please update payment method.`, status: 402 };
        }

        // 2. Check Quota (If increment > 0)
        if (increment > 0) {
            const quota = await queryOne<{ current_value: number; limit_value: number }>(
                `SELECT current_value, limit_value FROM saas_usage_quotas 
             WHERE saas_slug = ? AND tenant_id = ? AND quota_key = ?`,
                saasSlug, tenantId, action
            );

            if (quota) {
                if (quota.limit_value !== -1 && (quota.current_value + increment > quota.limit_value)) {
                    await logDeniedAccess(saasSlug, tenantId, action, "QUOTA_EXCEEDED", cid);
                    return { allowed: false, reason: "QUOTA_EXCEEDED", status: 429 };
                }

                // Atomic Increment
                await run(
                    `UPDATE saas_usage_quotas SET current_value = current_value + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
                 WHERE saas_slug = ? AND tenant_id = ? AND quota_key = ?`,
                    increment, saasSlug, tenantId, action
                );
            } else {
                // Quota key not found. FAIL CLOSED.
                await logDeniedAccess(saasSlug, tenantId, action, "QUOTA_NOT_DEFINED", cid);
                return { allowed: false, reason: "QUOTA_NOT_DEFINED", status: 403 };
            }
        }

        return { allowed: true, status: 200 };

    } catch (error) {
        console.error(`[Billing] Error enforcing ${cid}:`, error);
        return { allowed: false, reason: "SYSTEM_ERROR", status: 403 };
    }
}
