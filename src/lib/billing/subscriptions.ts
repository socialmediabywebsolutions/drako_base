import type Stripe from "stripe";
import { env } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
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
