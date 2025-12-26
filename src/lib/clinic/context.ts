import { env } from "@/lib/cf";
import { queryAll } from "@/lib/db";
import {
  listDemoClientSaas,
  listDemoClientSaasSubscriptions,
  type DemoClientSaasSubscription,
} from "@/lib/admin/demo-data";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { CLINIC_PLAN_CODE } from "@/lib/clinic/types";

export type ClinicContextMode = "d1" | "demo";

export type ClinicContext = {
  tenantId: string;
  saasId: string;
  clientId: string;
  mode: ClinicContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);

function hasDatabase(): boolean {
  return Boolean(env()?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const flag = env()?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function pickDemoSubscription(tenantId: string, saasId?: string | null): DemoClientSaasSubscription | null {
  const baseTenantId = tenantId === DEMO_TENANT_ID ? tenantId : DEMO_TENANT_ID;
  const subs = listDemoClientSaasSubscriptions(baseTenantId).filter((sub) => sub.plan_code === CLINIC_PLAN_CODE);
  const filtered = subs.filter((sub) => ACTIVE_SUBSCRIPTION_STATUSES.has(sub.status));
  if (saasId) {
    return filtered.find((sub) => sub.saas_id === saasId) ?? null;
  }
  return filtered[0] ?? null;
}

async function resolveDbClientForSaas(tenantId: string, saasId: string): Promise<string | null> {
  const linkRows = await queryAll<{ client_id: string }>(
    "SELECT client_id FROM client_saas WHERE tenant_id = ? AND saas_id = ? ORDER BY datetime(created_at) DESC LIMIT 1",
    tenantId,
    saasId,
  );
  if (linkRows[0]) return linkRows[0].client_id;
  const subRows = await queryAll<{ client_id: string }>(
    "SELECT client_id FROM client_saas_subscriptions WHERE tenant_id = ? AND saas_id = ? ORDER BY datetime(updated_at) DESC LIMIT 1",
    tenantId,
    saasId,
  );
  return subRows[0]?.client_id ?? null;
}

export class ClinicContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClinicContextError";
  }
}

export class NoActiveClinicSubscriptionError extends Error {
  constructor(message = "No active clinic subscription") {
    super(message);
    this.name = "NoActiveClinicSubscriptionError";
  }
}

async function findActiveDbSubscription(
  tenantId: string,
  saasId?: string | null,
): Promise<{ saasId: string; clientId: string } | null> {
  const params: Array<string> = [tenantId, CLINIC_PLAN_CODE];
  let sql = `SELECT saas_id, client_id
             FROM client_saas_subscriptions
             WHERE tenant_id = ? AND plan_code = ? AND status IN ('active','trialing')`;
  if (saasId) {
    sql += " AND saas_id = ?";
    params.push(saasId);
  }
  sql += " ORDER BY datetime(updated_at) DESC LIMIT 1";
  const rows = await queryAll<{ saas_id: string; client_id: string }>(sql, ...params);
  const record = rows[0];
  if (!record) return null;
  const clientId = record.client_id || (await resolveDbClientForSaas(tenantId, record.saas_id)) || "";
  if (!clientId) {
    throw new ClinicContextError("Clinic SaaS not linked to any client");
  }
  return { saasId: record.saas_id, clientId };
}

function resolveDemoContext(tenantId: string, saasId?: string | null): ClinicContext {
  const subscription = pickDemoSubscription(tenantId, saasId);
  if (!subscription) {
    throw new ClinicContextError("Demo clinic subscription not found");
  }
  const clientLink = listDemoClientSaas(DEMO_TENANT_ID).find((item) => item.saas_id === subscription.saas_id);
  if (!clientLink) {
    throw new ClinicContextError("Demo clinic client not found");
  }
  return {
    tenantId,
    saasId: subscription.saas_id,
    clientId: clientLink.client_id,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
  };
}

export async function resolveClinicContext(tenantId: string, saasId?: string | null): Promise<ClinicContext> {
  const demoEnabled = isDemoFeatureEnabled(tenantId);
  if (hasDatabase()) {
    try {
      const subscription = await findActiveDbSubscription(tenantId, saasId);
      if (subscription) {
        return {
          tenantId,
          saasId: subscription.saasId,
          clientId: subscription.clientId,
          mode: "d1",
          allowDemoFallback: demoEnabled,
          demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
        };
      }
    } catch (error) {
      if (!demoEnabled) throw error;
      return resolveDemoContext(tenantId, saasId);
    }
  }

  if (demoEnabled) {
    return resolveDemoContext(tenantId, saasId);
  }

  throw new NoActiveClinicSubscriptionError();
}
