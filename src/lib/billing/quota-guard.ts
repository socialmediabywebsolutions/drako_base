import { run } from "@/lib/db";
import { getCanonicalBillingEntitlements } from "@/lib/billing/subscriptions";

export type QuotaCheckResult = {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  statusCode?: number;
};

const ALLOWED_SUBSCRIPTION_STATUSES = new Set(["active", "trial", "trialing"]);

/**
 * Canonical quota guard wrapper.
 *
 * This helper preserves the historical API, but the decision now comes from
 * canonical billing entitlements instead of direct parallel reads.
 */
export async function checkQuota(params: {
  tenantId: string;
  saasSlug: string;
  quotaKey: string;
  increment?: number;
}): Promise<QuotaCheckResult> {
  const { tenantId, saasSlug, quotaKey, increment = 0 } = params;

  try {
    const entitlements = await getCanonicalBillingEntitlements({ tenantId, saasSlug });
    const status = entitlements.subscriptionStatus?.trim().toLowerCase() ?? "";

    if (!status || !entitlements.hasVerifiedSubscription) {
      return { allowed: false, reason: "SUBSCRIPTION_MISSING", statusCode: 403 };
    }

    if (status === "incomplete") {
      return { allowed: false, reason: "SUBSCRIPTION_INCOMPLETE", statusCode: 402 };
    }

    if (status === "past_due") {
      return { allowed: false, reason: "PAST_DUE_BLOCK", statusCode: 402 };
    }

    if (!ALLOWED_SUBSCRIPTION_STATUSES.has(status)) {
      return {
        allowed: false,
        reason: `SUBSCRIPTION_${status.toUpperCase()}`,
        statusCode: 402,
      };
    }

    const limit = entitlements.limits[quotaKey];
    const current = entitlements.usage[quotaKey];
    if (typeof limit !== "number" || typeof current !== "number") {
      return { allowed: false, reason: "QUOTA_NOT_INITIALIZED", statusCode: 403 };
    }

    if (limit === -1) {
      return { allowed: true, current, limit: -1 };
    }

    if (current + increment > limit) {
      return {
        allowed: false,
        reason: "QUOTA_EXCEEDED",
        current,
        limit,
        statusCode: 429,
      };
    }

    return { allowed: true, current, limit };
  } catch (error) {
    console.error("[Billing] Quota guard failed closed", error);
    return { allowed: false, reason: "SYSTEM_ERROR", statusCode: 403 };
  }
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
    quotaKey,
  );
}
