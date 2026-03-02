import { queryAll, run } from "@/lib/db";

export const DEMO_TENANT_ID = "demo-tenant";

export type ResolveTenantIdOptions = {
  fallbackTenantId?: string | null;
  allowUntrustedOverride?: boolean;
};

type TenantRecord = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type TenantDepartmentRecord = {
  id: string;
  tenant_id: string;
  core_department_id: string | null;
  name: string;
  slug: string;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type TenantAgentRecord = {
  id: string;
  tenant_id: string;
  core_agent_id: string | null;
  department_id: string | null;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export function resolveTenantId(req?: Request | null, options: ResolveTenantIdOptions = {}): string {
  const hasFallback = Object.prototype.hasOwnProperty.call(options, "fallbackTenantId");
  const fallbackTenantId = hasFallback ? options.fallbackTenantId : DEMO_TENANT_ID;
  if (!req) return fallbackTenantId ?? "";

  // Trusted tenant resolution comes from middleware host mapping.
  const trustedHeader = req.headers.get("x-drako-tenant-id")?.trim();
  if (trustedHeader) return trustedHeader;

  // Legacy override mode is restricted to explicitly internal use-cases only.
  if (options.allowUntrustedOverride) {
    const legacyHeader = req.headers.get("x-tenant-id")?.trim();
    if (legacyHeader) return legacyHeader;

    const url = new URL(req.url);
    const queryTenantId = url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id");
    if (queryTenantId && queryTenantId.trim().length > 0) {
      return queryTenantId.trim();
    }
  }

  return fallbackTenantId ?? "";
}

export async function getTenantBySlug(slug: string): Promise<TenantRecord | null> {
  const rows = await queryAll<TenantRecord>(
    "SELECT id, slug, name, plan, status, created_at, updated_at FROM tenants WHERE slug = ? LIMIT 1",
    slug,
  );
  return rows[0] ?? null;
}

export async function ensureDemoTenant() {
  await run(
    `INSERT INTO tenants (id, slug, name, plan, status)
     VALUES (?, 'demo', 'DRĀKO Demo Tenant', 'starter', 'active')
     ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, name = excluded.name, plan = excluded.plan,
       status = excluded.status, updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    DEMO_TENANT_ID,
  );
}

export async function getTenantDepartments(tenantId: string): Promise<TenantDepartmentRecord[]> {
  return queryAll<TenantDepartmentRecord>(
    `SELECT id, tenant_id, core_department_id, name, slug, is_active, created_at, updated_at
     FROM tenant_departments WHERE tenant_id = ? ORDER BY name ASC`,
    tenantId,
  );
}

export async function getTenantAgents(tenantId: string): Promise<TenantAgentRecord[]> {
  return queryAll<TenantAgentRecord>(
    `SELECT id, tenant_id, core_agent_id, department_id, name, slug, status, created_at, updated_at
     FROM tenant_agents WHERE tenant_id = ? ORDER BY created_at DESC`,
    tenantId,
  );
}

export async function createTenant(params: { name: string; slug: string; plan?: string }): Promise<string> {
  const id = `tenant_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  await run(
    `INSERT INTO tenants (id, slug, name, plan, status) VALUES (?, ?, ?, ?, 'pending_payment')`,
    id,
    params.slug,
    params.name,
    params.plan ?? "starter",
  );
  return id;
}

export async function createTenantUser(params: { tenantId: string; email: string; role: string }): Promise<string> {
  const id = `u_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  await run(
    `INSERT INTO tenant_users (id, tenant_id, email, role) VALUES (?, ?, ?, ?)`,
    id,
    params.tenantId,
    params.email,
    params.role,
  );
  return id;
}
