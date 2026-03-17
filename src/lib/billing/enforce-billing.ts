
import { queryOne, run } from "@/lib/db";
import { writeBillingAuditLog } from "@/lib/billing/billing-audit";
import { getCanonicalBillingEntitlements } from "@/lib/billing/subscriptions";
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
        await writeBillingAuditLog({
            id: `deny_${correlationId}`,
            saasSlug,
            tenantId,
            eventType: "access_denied",
            severity: "warning",
            correlationId,
            metadata: { action, reason },
        });
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
        const entitlements = await getCanonicalBillingEntitlements({ tenantId, saasSlug });
        const status = entitlements.subscriptionStatus;
        if (!status || !entitlements.hasVerifiedSubscription) {
            await logDeniedAccess(saasSlug, tenantId, action, "NEEDS_BILLING", cid);
            return { allowed: false, reason: "needs_billing", status: 403 };
        }

        if (status === "incomplete") {
            await logDeniedAccess(saasSlug, tenantId, action, "SUBSCRIPTION_INCOMPLETE", cid);
            return { allowed: false, reason: "SUBSCRIPTION_INCOMPLETE", status: 402 };
        }

        if (status === "past_due") {
            await logDeniedAccess(saasSlug, tenantId, action, "PAST_DUE_BLOCK", cid);
            return { allowed: false, reason: "PAST_DUE_BLOCK", status: 402 };
        }

        const allowedStatuses = ["active", "trial", "trialing"];
        if (!allowedStatuses.includes(status)) {
            await logDeniedAccess(saasSlug, tenantId, action, `SUBSCRIPTION_${status.toUpperCase()}`, cid);
            return { allowed: false, reason: `SUBSCRIPTION_${status.toUpperCase()}`, status: 402 };
        }

        // 2. Check Quota (If increment > 0)
        if (increment > 0) {
            const entitlementsLimit = entitlements.limits[action];
            if (typeof entitlementsLimit !== "number") {
                await logDeniedAccess(saasSlug, tenantId, action, "QUOTA_NOT_DEFINED", cid);
                return { allowed: false, reason: "QUOTA_NOT_DEFINED", status: 403 };
            }
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
