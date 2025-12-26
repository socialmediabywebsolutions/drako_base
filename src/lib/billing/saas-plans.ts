import { env } from "@/lib/cf";
import { queryAll } from "@/lib/db";
import {
  findDemoSaasPlanByCode,
  findDemoSaasPlanById,
  listDemoSaasPlans,
  type DemoSaasPlan,
} from "@/lib/admin/demo-data";

export type SaasPlan = {
  id: string;
  tenantId: string;
  saasId: string;
  planCode: string;
  name: string;
  billingInterval: "month" | "year";
  amount: number;
  currency: string;
  stripeProductId: string;
  stripePriceId: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

function hasDatabase(): boolean {
  return Boolean(env());
}

const SELECT_COLUMNS = `
  id, tenant_id, saas_id, plan_code, name, billing_interval, amount,
  currency, stripe_product_id, stripe_price_id, status, created_at, updated_at
`;

type SaasPlanRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  plan_code: string;
  name: string;
  billing_interval: "month" | "year";
  amount: number;
  currency: string;
  stripe_product_id: string;
  stripe_price_id: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

function mapRow(row: SaasPlanRow): SaasPlan {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    planCode: row.plan_code,
    name: row.name,
    billingInterval: row.billing_interval,
    amount: row.amount,
    currency: row.currency,
    stripeProductId: row.stripe_product_id,
    stripePriceId: row.stripe_price_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDemoPlan(plan: DemoSaasPlan): SaasPlan {
  return {
    id: plan.id,
    tenantId: plan.tenant_id,
    saasId: plan.saas_id,
    planCode: plan.plan_code,
    name: plan.name,
    billingInterval: plan.billing_interval,
    amount: plan.amount,
    currency: plan.currency,
    stripeProductId: plan.stripe_product_id,
    stripePriceId: plan.stripe_price_id,
    status: plan.status,
    createdAt: plan.created_at,
    updatedAt: plan.updated_at,
  };
}

export async function getSaasPlansForTenant(tenantId: string): Promise<SaasPlan[]> {
  if (hasDatabase()) {
    const rows = await queryAll<SaasPlanRow>(
      `SELECT ${SELECT_COLUMNS} FROM saas_plans WHERE tenant_id = ? ORDER BY name ASC`,
      tenantId,
    );
    return rows.map(mapRow);
  }
  return listDemoSaasPlans(tenantId).map(mapDemoPlan);
}

export async function getSaasPlansForSaas(tenantId: string, saasId: string): Promise<SaasPlan[]> {
  if (hasDatabase()) {
    const rows = await queryAll<SaasPlanRow>(
      `SELECT ${SELECT_COLUMNS} FROM saas_plans WHERE tenant_id = ? AND saas_id = ? ORDER BY name ASC`,
      tenantId,
      saasId,
    );
    return rows.map(mapRow);
  }
  return listDemoSaasPlans(tenantId)
    .filter((plan) => plan.saas_id === saasId)
    .map(mapDemoPlan);
}

export async function getSaasPlanById(tenantId: string, planId: string): Promise<SaasPlan | null> {
  if (hasDatabase()) {
    const rows = await queryAll<SaasPlanRow>(
      `SELECT ${SELECT_COLUMNS} FROM saas_plans WHERE tenant_id = ? AND id = ? LIMIT 1`,
      tenantId,
      planId,
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
  const plan = findDemoSaasPlanById(tenantId, planId);
  return plan ? mapDemoPlan(plan) : null;
}

export async function getSaasPlanByCode(tenantId: string, saasId: string, planCode: string): Promise<SaasPlan | null> {
  if (hasDatabase()) {
    const rows = await queryAll<SaasPlanRow>(
      `SELECT ${SELECT_COLUMNS} FROM saas_plans WHERE tenant_id = ? AND saas_id = ? AND plan_code = ? LIMIT 1`,
      tenantId,
      saasId,
      planCode,
    );
    return rows[0] ? mapRow(rows[0]) : null;
  }
  const plan = findDemoSaasPlanByCode(tenantId, saasId, planCode);
  return plan ? mapDemoPlan(plan) : null;
}
