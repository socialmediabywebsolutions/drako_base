import { env } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import {
  listDemoClientSaasSubscriptions,
  listDemoClientSaasSubscriptionsByClient,
  listDemoClientSaasSubscriptionsBySaas,
  upsertDemoClientSaasSubscription,
  type DemoClientSaasSubscription,
} from "@/lib/admin/demo-data";

export type ClientSaasSubscription = {
  id: string;
  tenantId: string;
  clientId: string;
  saasId: string;
  saasPlanId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planCode: string;
  status: string;
  currentPeriodEnd: number | null;
  createdAt: string;
  updatedAt: string;
};

function hasDatabase(): boolean {
  return Boolean(env());
}

const SELECT_COLUMNS = `
  id, tenant_id, client_id, saas_id, saas_plan_id, stripe_customer_id,
  stripe_subscription_id, plan_code, status, current_period_end, created_at, updated_at
`;

type SubscriptionRow = {
  id: string;
  tenant_id: string;
  client_id: string;
  saas_id: string;
  saas_plan_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  plan_code: string;
  status: string;
  current_period_end: number | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: SubscriptionRow): ClientSaasSubscription {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    clientId: row.client_id,
    saasId: row.saas_id,
    saasPlanId: row.saas_plan_id,
    stripeCustomerId: row.stripe_customer_id,
    stripeSubscriptionId: row.stripe_subscription_id,
    planCode: row.plan_code,
    status: row.status,
    currentPeriodEnd: row.current_period_end ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDemo(subscription: DemoClientSaasSubscription): ClientSaasSubscription {
  return {
    id: subscription.id,
    tenantId: subscription.tenant_id,
    clientId: subscription.client_id,
    saasId: subscription.saas_id,
    saasPlanId: subscription.saas_plan_id,
    stripeCustomerId: subscription.stripe_customer_id,
    stripeSubscriptionId: subscription.stripe_subscription_id,
    planCode: subscription.plan_code,
    status: subscription.status,
    currentPeriodEnd: subscription.current_period_end,
    createdAt: subscription.created_at,
    updatedAt: subscription.updated_at,
  };
}

export async function getTenantClientSaasSubscriptions(tenantId: string): Promise<ClientSaasSubscription[]> {
  if (hasDatabase()) {
    const rows = await queryAll<SubscriptionRow>(
      `SELECT ${SELECT_COLUMNS} FROM client_saas_subscriptions WHERE tenant_id = ? ORDER BY updated_at DESC`,
      tenantId,
    );
    return rows.map(mapRow);
  }
  return listDemoClientSaasSubscriptions(tenantId).map(mapDemo);
}

export async function getClientSaasSubscriptions(tenantId: string, clientId: string): Promise<ClientSaasSubscription[]> {
  if (hasDatabase()) {
    const rows = await queryAll<SubscriptionRow>(
      `SELECT ${SELECT_COLUMNS} FROM client_saas_subscriptions WHERE tenant_id = ? AND client_id = ? ORDER BY updated_at DESC`,
      tenantId,
      clientId,
    );
    return rows.map(mapRow);
  }
  return listDemoClientSaasSubscriptionsByClient(tenantId, clientId).map(mapDemo);
}

export async function getSaasSubscriptions(tenantId: string, saasId: string): Promise<ClientSaasSubscription[]> {
  if (hasDatabase()) {
    const rows = await queryAll<SubscriptionRow>(
      `SELECT ${SELECT_COLUMNS} FROM client_saas_subscriptions WHERE tenant_id = ? AND saas_id = ? ORDER BY updated_at DESC`,
      tenantId,
      saasId,
    );
    return rows.map(mapRow);
  }
  return listDemoClientSaasSubscriptionsBySaas(tenantId, saasId).map(mapDemo);
}

export async function saveClientSaasSubscription(record: {
  tenantId: string;
  clientId: string;
  saasId: string;
  saasPlanId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  planCode: string;
  status: string;
  currentPeriodEnd: number | null;
}): Promise<void> {
  const nowIso = new Date().toISOString();
  if (hasDatabase()) {
    const id = record.stripeSubscriptionId;
    await run(
      `INSERT INTO client_saas_subscriptions (
        id, tenant_id, client_id, saas_id, saas_plan_id, stripe_customer_id,
        stripe_subscription_id, plan_code, status, current_period_end, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(stripe_subscription_id) DO UPDATE SET
        client_id = excluded.client_id,
        saas_id = excluded.saas_id,
        saas_plan_id = excluded.saas_plan_id,
        plan_code = excluded.plan_code,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        updated_at = excluded.updated_at`,
      id,
      record.tenantId,
      record.clientId,
      record.saasId,
      record.saasPlanId,
      record.stripeCustomerId,
      record.stripeSubscriptionId,
      record.planCode,
      record.status,
      record.currentPeriodEnd ?? null,
      nowIso,
      nowIso,
    );
    return;
  }

  upsertDemoClientSaasSubscription(record.tenantId, {
    client_id: record.clientId,
    saas_id: record.saasId,
    saas_plan_id: record.saasPlanId,
    stripe_customer_id: record.stripeCustomerId,
    stripe_subscription_id: record.stripeSubscriptionId,
    plan_code: record.planCode,
    status: record.status,
    current_period_end: record.currentPeriodEnd ?? null,
  });
}
