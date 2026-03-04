import type Stripe from "stripe";
import { env } from "@/lib/cf";
import { queryAll, queryOne, run } from "@/lib/db";
import { listDemoSubscriptions, upsertDemoSubscription } from "@/lib/admin/demo-data";

export type SubscriptionStatus = Stripe.Subscription.Status;

export type SubscriptionRecord = {
  id: string;
  tenantId: string;
  clientId: string;
  saasId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan: string;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null;
  createdAt: string;
  updatedAt: string;
};

const PLAN_CODE = "drako_base_starter";
const ENTITLED_STATUSES = new Set(["active", "trialing", "trial"]);

function normalizePlanCode(planCode: string | null | undefined): string | null {
  if (!planCode) return null;
  const normalized = planCode.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("drako_base_")) {
    return normalized.replace("drako_base_", "");
  }
  return normalized;
}

function normalizeIsoTimestamp(value: number | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "number") {
    return new Date(value * 1000).toISOString();
  }
  const raw = value.trim();
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export type CanonicalSubscriptionStatus =
  | "trial"
  | "trialing"
  | "active"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";

export type CanonicalSubscriptionState = {
  tenantId: string;
  saasSlug: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string | null;
  planCode: string | null;
  status: CanonicalSubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  updatedAt: string;
};

function hasDatabase(): boolean {
  return Boolean(env());
}

export async function getSubscriptionForTenant(tenantId: string): Promise<SubscriptionRecord | null> {
  if (hasDatabase()) {
    const rows = await queryAll<{
      id: string;
      tenant_id: string;
      client_id: string;
      saas_id: string;
      stripe_customer_id: string;
      stripe_subscription_id: string;
      plan: string;
      status: SubscriptionStatus;
      current_period_end: number | null;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, tenant_id, client_id, saas_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, created_at, updated_at
       FROM drako_subscriptions
       WHERE tenant_id = ? AND plan = ?
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`,
      tenantId,
      PLAN_CODE,
    );
    const record = rows[0];
    if (!record) {
      return null;
    }
    return {
      id: record.id,
      tenantId: record.tenant_id,
      clientId: record.client_id,
      saasId: record.saas_id,
      stripeCustomerId: record.stripe_customer_id,
      stripeSubscriptionId: record.stripe_subscription_id,
      plan: record.plan,
      status: record.status,
      currentPeriodEnd: record.current_period_end ?? null,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }

  const demo = listDemoSubscriptions(tenantId)
    .filter((item) => item.plan === PLAN_CODE)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  const record = demo[0];
  if (!record) {
    return null;
  }
  return {
    id: record.id,
    tenantId: record.tenant_id,
    clientId: record.client_id,
    saasId: record.saas_id,
    stripeCustomerId: record.stripe_customer_id,
    stripeSubscriptionId: record.stripe_subscription_id,
    plan: record.plan,
    status: record.status as SubscriptionStatus,
    currentPeriodEnd: record.current_period_end,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export async function saveSubscriptionRecord(record: {
  tenantId: string;
  clientId: string;
  saasId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  plan?: string;
  status: SubscriptionStatus;
  currentPeriodEnd: number | null;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const plan = record.plan ?? PLAN_CODE;
  if (hasDatabase()) {
    const id = record.stripeSubscriptionId;
    await run(
      `INSERT INTO drako_subscriptions (
        id, tenant_id, client_id, saas_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stripe_subscription_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        client_id = excluded.client_id,
        saas_id = excluded.saas_id,
        plan = excluded.plan,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        updated_at = excluded.updated_at`,
      id,
      record.tenantId,
      record.clientId,
      record.saasId,
      record.stripeCustomerId,
      record.stripeSubscriptionId,
      plan,
      record.status,
      record.currentPeriodEnd ?? null,
      nowIso,
      nowIso,
    );
    return;
  }

  upsertDemoSubscription(record.tenantId, {
    stripe_subscription_id: record.stripeSubscriptionId,
    stripe_customer_id: record.stripeCustomerId,
    client_id: record.clientId,
    saas_id: record.saasId,
    plan,
    status: record.status,
    current_period_end: record.currentPeriodEnd ?? null,
  });
}

export function getPlanCode(): string {
  return PLAN_CODE;
}

export async function upsertCanonicalSubscriptionState(input: {
  tenantId: string;
  saasSlug: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId?: string | null;
  planCode?: string | null;
  status: string;
  currentPeriodEnd?: number | string | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const planCode = normalizePlanCode(input.planCode);
  const currentPeriodEnd = normalizeIsoTimestamp(input.currentPeriodEnd);
  const status = input.status.trim().toLowerCase();
  const id = `${input.tenantId}:${input.saasSlug}`;

  try {
    await run(
      `INSERT INTO saas_subscriptions (
        id, saas_slug, tenant_id, plan_code, status, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        current_period_end, cancel_at_period_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(saas_slug, tenant_id) DO UPDATE SET
        plan_code = excluded.plan_code,
        status = excluded.status,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_price_id = excluded.stripe_price_id,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        updated_at = excluded.updated_at`,
      id,
      input.saasSlug,
      input.tenantId,
      planCode,
      status,
      input.stripeCustomerId,
      input.stripeSubscriptionId,
      input.stripePriceId ?? null,
      currentPeriodEnd,
      input.cancelAtPeriodEnd ? 1 : 0,
      nowIso,
      nowIso,
    );
  } catch (error) {
    // Backward-compatible fallback for schemas without stripe_price_id/cancel_at_period_end.
    if (!(error instanceof Error) || !/no such column/i.test(error.message)) {
      throw error;
    }
    await run(
      `INSERT INTO saas_subscriptions (
        id, saas_slug, tenant_id, plan_code, status, stripe_customer_id, stripe_subscription_id, current_period_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(saas_slug, tenant_id) DO UPDATE SET
        plan_code = excluded.plan_code,
        status = excluded.status,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        current_period_end = excluded.current_period_end,
        updated_at = excluded.updated_at`,
      id,
      input.saasSlug,
      input.tenantId,
      planCode,
      status,
      input.stripeCustomerId,
      input.stripeSubscriptionId,
      currentPeriodEnd,
      nowIso,
      nowIso,
    );
  }
}

export async function getCanonicalSubscriptionState(input: {
  tenantId: string;
  saasSlug: string;
}): Promise<CanonicalSubscriptionState | null> {
  let row: {
    tenant_id: string;
    saas_slug: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id?: string | null;
    plan_code: string | null;
    status: string;
    current_period_end: string | null;
    cancel_at_period_end?: number | null;
    updated_at: string;
  } | null = null;
  try {
    row = await queryOne<{
      tenant_id: string;
      saas_slug: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_price_id?: string | null;
      plan_code: string | null;
      status: string;
      current_period_end: string | null;
      cancel_at_period_end?: number | null;
      updated_at: string;
    }>(
      `SELECT tenant_id, saas_slug, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_code, status, current_period_end, cancel_at_period_end, updated_at
       FROM saas_subscriptions
       WHERE tenant_id = ? AND saas_slug = ?
       LIMIT 1`,
      input.tenantId,
      input.saasSlug,
    );
  } catch (error) {
    if (!(error instanceof Error) || !/no such column/i.test(error.message)) {
      throw error;
    }
    row = await queryOne<{
      tenant_id: string;
      saas_slug: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      plan_code: string | null;
      status: string;
      current_period_end: string | null;
      updated_at: string;
    }>(
      `SELECT tenant_id, saas_slug, stripe_customer_id, stripe_subscription_id, plan_code, status, current_period_end, updated_at
       FROM saas_subscriptions
       WHERE tenant_id = ? AND saas_slug = ?
       LIMIT 1`,
      input.tenantId,
      input.saasSlug,
    );
  }
  if (!row?.stripe_customer_id || !row.stripe_subscription_id) {
    return null;
  }

  return {
    tenantId: row.tenant_id,
    saasSlug: row.saas_slug,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    stripePriceId: row.stripe_price_id ?? null,
    planCode: normalizePlanCode(row.plan_code),
    status: row.status as CanonicalSubscriptionStatus,
    currentPeriodEnd: row.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
    updatedAt: row.updated_at,
  };
}

export async function syncSaasUsageQuotasFromPlan(input: {
  tenantId: string;
  saasSlug: string;
  planCode: string | null | undefined;
  status: string;
}): Promise<void> {
  const normalizedPlanCode = normalizePlanCode(input.planCode);
  if (!normalizedPlanCode) return;
  if (!ENTITLED_STATUSES.has(input.status.trim().toLowerCase())) return;

  const plan = await queryOne<{ limits_json: string | null }>(
    `SELECT limits_json
     FROM saas_pricing_plans
     WHERE saas_slug = ? AND plan_code = ? AND is_active = 1
     LIMIT 1`,
    input.saasSlug,
    normalizedPlanCode,
  );
  if (!plan?.limits_json) return;

  let limits: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(plan.limits_json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      limits = parsed as Record<string, unknown>;
    }
  } catch {
    return;
  }

  const nowIso = new Date().toISOString();
  const periodEndIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  for (const [quotaKeyRaw, limitRaw] of Object.entries(limits)) {
    const quotaKey = quotaKeyRaw.trim();
    if (!quotaKey) continue;
    const numericLimit =
      typeof limitRaw === "number"
        ? limitRaw
        : typeof limitRaw === "string"
          ? Number(limitRaw)
          : Number.NaN;
    if (!Number.isFinite(numericLimit)) continue;

    await run(
      `INSERT INTO saas_usage_quotas (id, saas_slug, tenant_id, quota_key, current_value, limit_value, period_start, period_end, reset_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
       ON CONFLICT(saas_slug, tenant_id, quota_key) DO UPDATE SET
         limit_value = excluded.limit_value,
         period_start = excluded.period_start,
         period_end = excluded.period_end,
         reset_at = excluded.reset_at,
         updated_at = excluded.updated_at`,
      `${input.tenantId}:${input.saasSlug}:${quotaKey}`,
      input.saasSlug,
      input.tenantId,
      quotaKey,
      Math.trunc(numericLimit),
      nowIso,
      periodEndIso,
      periodEndIso,
      nowIso,
    );
  }
}
