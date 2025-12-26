import { env } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type EmployeesContextMode = "d1" | "demo";

export type EmployeesContext = {
  tenantId: string;
  saasId: string | null;
  mode: EmployeesContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
};

function hasDatabase(): boolean {
  return Boolean(env()?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const flag = env()?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

export class EmployeesContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmployeesContextError";
  }
}

export async function resolveEmployeesContext(tenantId: string, saasId?: string | null): Promise<EmployeesContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId);

  if (hasDatabase()) {
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
    };
  }

  if (!demoEnabled) {
    throw new EmployeesContextError("Employees module is not enabled for this tenant");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
  };
}
