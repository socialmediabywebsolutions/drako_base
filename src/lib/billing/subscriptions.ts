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

function isMissingColumnError(error: unknown): boolean {
  return error instanceof Error && /(?:no such column|has no column named)/i.test(error.message);
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Error && /no such table/i.test(error.message);
}

function normalizeNumericValue(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
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

export type CanonicalBillingEntitlements = {
  tenantId: string;
  saasSlug: string;
  saasId: string | null;
  subscriptionStatus: string | null;
  hasVerifiedSubscription: boolean;
  limits: Record<string, number>;
  features: string[];
  usage: CanonicalBillingUsage;
};

export type CanonicalBillingUsage = Record<string, number>;

export type CanonicalBillingSnapshot = {
  tenantId: string;
  saasSlug: string;
  saasId: string | null;
  subscription: {
    status: CanonicalSubscriptionStatus | null;
    planCode: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    trial: boolean | null;
    cancelAtPeriodEnd: boolean | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    updatedAt: string | null;
  };
  entitlements: {
    limits: Record<string, number>;
    features: string[];
    usage: CanonicalBillingUsage;
  };
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
  currentPeriodStart?: number | string | null;
  currentPeriodEnd?: number | string | null;
  cancelAtPeriodEnd?: boolean;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  const planCode = normalizePlanCode(input.planCode);
  const currentPeriodStart = normalizeIsoTimestamp(input.currentPeriodStart);
  const currentPeriodEnd = normalizeIsoTimestamp(input.currentPeriodEnd);
  const status = input.status.trim().toLowerCase();
  const id = `${input.tenantId}:${input.saasSlug}`;

  try {
    await run(
      `INSERT INTO saas_subscriptions (
        id, saas_slug, tenant_id, plan_code, status, stripe_customer_id, stripe_subscription_id, stripe_price_id,
        current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(saas_slug, tenant_id) DO UPDATE SET
        plan_code = excluded.plan_code,
        status = excluded.status,
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_subscription_id = excluded.stripe_subscription_id,
        stripe_price_id = excluded.stripe_price_id,
        current_period_start = excluded.current_period_start,
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
      currentPeriodStart,
      currentPeriodEnd,
      input.cancelAtPeriodEnd ? 1 : 0,
      nowIso,
      nowIso,
    );
  } catch (error) {
    // Backward-compatible fallback for schemas without stripe_price_id/cancel_at_period_end.
    if (!isMissingColumnError(error)) {
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

export async function updateCanonicalSubscriptionLifecycleState(input: {
  stripeSubscriptionId: string;
  saasSlug: string;
  status: string;
  currentPeriodEnd?: number | string | null;
  cancelAtPeriodEnd?: boolean | null;
}): Promise<void> {
  const normalizedStatus = input.status.trim().toLowerCase();
  const currentPeriodEnd = normalizeIsoTimestamp(input.currentPeriodEnd);
  const cancelAtPeriodEnd =
    typeof input.cancelAtPeriodEnd === "boolean" ? (input.cancelAtPeriodEnd ? 1 : 0) : null;

  try {
    await run(
      `UPDATE saas_subscriptions
       SET status = ?,
           current_period_end = COALESCE(?, current_period_end),
           cancel_at_period_end = COALESCE(?, cancel_at_period_end),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE stripe_subscription_id = ? AND saas_slug = ?`,
      normalizedStatus,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      input.stripeSubscriptionId,
      input.saasSlug,
    );
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    await run(
      `UPDATE saas_subscriptions
       SET status = ?,
           current_period_end = COALESCE(?, current_period_end),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE stripe_subscription_id = ? AND saas_slug = ?`,
      normalizedStatus,
      currentPeriodEnd,
      input.stripeSubscriptionId,
      input.saasSlug,
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
    if (!isMissingColumnError(error)) {
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

async function getCanonicalSubscriptionRow(input: {
  tenantId: string;
  saasSlug: string;
}): Promise<{
  tenant_id: string;
  saas_slug: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id?: string | null;
  plan_code: string | null;
  status: string;
  current_period_start?: string | null;
  current_period_end: string | null;
  cancel_at_period_end?: number | null;
  updated_at: string;
} | null> {
  try {
    return await queryOne<{
      tenant_id: string;
      saas_slug: string;
      stripe_customer_id: string | null;
      stripe_subscription_id: string | null;
      stripe_price_id?: string | null;
      plan_code: string | null;
      status: string;
      current_period_start?: string | null;
      current_period_end: string | null;
      cancel_at_period_end?: number | null;
      updated_at: string;
    }>(
      `SELECT tenant_id, saas_slug, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_code, status,
              current_period_start, current_period_end, cancel_at_period_end, updated_at
       FROM saas_subscriptions
       WHERE tenant_id = ? AND saas_slug = ?
       LIMIT 1`,
      input.tenantId,
      input.saasSlug,
    );
  } catch (error) {
    if (!isMissingColumnError(error)) {
      throw error;
    }
    return queryOne<{
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
      `SELECT tenant_id, saas_slug, stripe_customer_id, stripe_subscription_id, stripe_price_id, plan_code, status,
              current_period_end, cancel_at_period_end, updated_at
       FROM saas_subscriptions
       WHERE tenant_id = ? AND saas_slug = ?
       LIMIT 1`,
      input.tenantId,
      input.saasSlug,
    );
  }
}

async function resolveCanonicalSaasId(input: {
  tenantId: string;
  saasSlug: string;
}): Promise<string | null> {
  try {
    const instance = await queryOne<{ id: string }>(
      `SELECT id
       FROM saas_instances
       WHERE tenant_id = ? AND slug = ?
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`,
      input.tenantId,
      input.saasSlug,
    );
    if (instance?.id) return instance.id;
  } catch (error) {
    if (!isMissingTableError(error) && !isMissingColumnError(error)) {
      throw error;
    }
  }

  try {
    const saas = await queryOne<{ id: string }>(
      `SELECT id
       FROM saas
       WHERE tenant_id = ? AND slug = ?
       LIMIT 1`,
      input.tenantId,
      input.saasSlug,
    );
    return saas?.id ?? null;
  } catch (error) {
    if (!isMissingTableError(error) && !isMissingColumnError(error)) {
      throw error;
    }
  }

  return null;
}

async function readCanonicalLimitsAndUsage(input: {
  tenantId: string;
  saasSlug: string;
}): Promise<{ limits: Record<string, number>; usage: CanonicalBillingUsage }> {
  const rows = await queryAll<{ quota_key: string; limit_value: number | string; current_value: number | string }>(
    `SELECT quota_key, limit_value, current_value
     FROM saas_usage_quotas
     WHERE tenant_id = ? AND saas_slug = ?`,
    input.tenantId,
    input.saasSlug,
  );

  const limits: Record<string, number> = {};
  const usage: CanonicalBillingUsage = {};

  for (const row of rows) {
    const key = row.quota_key?.trim();
    if (!key) continue;
    limits[key] = normalizeNumericValue(row.limit_value);
    usage[key] = normalizeNumericValue(row.current_value);
  }

  return { limits, usage };
}

async function readCanonicalFeatures(input: {
  tenantId: string;
  saasId: string | null;
}): Promise<string[]> {
  if (!input.saasId) return [];

  try {
    const rows = await queryAll<{ feature_key: string }>(
      `SELECT feature_key
       FROM saas_features
       WHERE tenant_id = ? AND saas_id = ? AND status = 'ENABLED'
       ORDER BY feature_key ASC`,
      input.tenantId,
      input.saasId,
    );

    return rows
      .map((row) => row.feature_key?.trim())
      .filter((value): value is string => Boolean(value));
  } catch (error) {
    if (isMissingTableError(error) || isMissingColumnError(error)) {
      return [];
    }
    throw error;
  }
}

export async function getCanonicalBillingSnapshot(input: {
  tenantId: string;
  saasSlug: string;
}): Promise<CanonicalBillingSnapshot> {
  const [subscriptionRow, saasId, quotas] = await Promise.all([
    getCanonicalSubscriptionRow(input),
    resolveCanonicalSaasId(input),
    readCanonicalLimitsAndUsage(input),
  ]);
  const features = await readCanonicalFeatures({ tenantId: input.tenantId, saasId });
  const normalizedStatus = subscriptionRow?.status?.trim().toLowerCase() as CanonicalSubscriptionStatus | undefined;

  return {
    tenantId: input.tenantId,
    saasSlug: input.saasSlug,
    saasId,
    subscription: {
      status: normalizedStatus ?? null,
      planCode: normalizePlanCode(subscriptionRow?.plan_code),
      currentPeriodStart: subscriptionRow?.current_period_start ?? null,
      currentPeriodEnd: subscriptionRow?.current_period_end ?? null,
      trial: normalizedStatus ? normalizedStatus === "trial" || normalizedStatus === "trialing" : null,
      cancelAtPeriodEnd:
        typeof subscriptionRow?.cancel_at_period_end === "number"
          ? Boolean(subscriptionRow.cancel_at_period_end)
          : null,
      stripeCustomerId: subscriptionRow?.stripe_customer_id ?? null,
      stripeSubscriptionId: subscriptionRow?.stripe_subscription_id ?? null,
      stripePriceId: subscriptionRow?.stripe_price_id ?? null,
      updatedAt: subscriptionRow?.updated_at ?? null,
    },
    entitlements: {
      limits: quotas.limits,
      features,
      usage: quotas.usage,
    },
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

export async function getCanonicalBillingEntitlements(input: {
  tenantId: string;
  saasSlug: string;
}): Promise<CanonicalBillingEntitlements> {
  const snapshot = await getCanonicalBillingSnapshot(input);
  const hasVerifiedSubscription = Boolean(
    snapshot.subscription.stripeCustomerId && snapshot.subscription.stripeSubscriptionId,
  );

  return {
    tenantId: input.tenantId,
    saasSlug: input.saasSlug,
    saasId: snapshot.saasId,
    subscriptionStatus: snapshot.subscription.status,
    hasVerifiedSubscription,
    limits: snapshot.entitlements.limits,
    features: snapshot.entitlements.features,
    usage: snapshot.entitlements.usage,
  };
}
