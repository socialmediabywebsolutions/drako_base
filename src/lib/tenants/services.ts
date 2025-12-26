import { queryAll, run } from "@/lib/db";

export const DEMO_TENANT_ID = "demo-tenant";

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

export function resolveTenantId(req?: Request | null): string {
  if (!req) return DEMO_TENANT_ID;
  const header = req.headers.get("x-tenant-id")?.trim();
  if (header) return header;
  const url = new URL(req.url);
  const param = url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id");
  if (param && param.trim().length > 0) {
    return param.trim();
  }
  return DEMO_TENANT_ID;
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
