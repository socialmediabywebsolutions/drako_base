import { resolveSocialContext } from "@/lib/socialflow/repository";
import type { EmpresaService, CreateServiceInput, UpdateServiceInput } from "./types";

const TABLE = "saas_empresa_services";

type ServiceRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  description: string | null;
  category: string | null;
  active: number;
  created_at: string;
};

function rowToService(row: ServiceRow): EmpresaService {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    name: row.name,
    description: row.description,
    category: row.category,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

async function getDb(tenantId: string, saasId: string) {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  return ctx.socialDb;
}

export async function getServicesByTenant(
  tenantId: string,
  saasId: string,
): Promise<EmpresaService[]> {
  const db = await getDb(tenantId, saasId);
  const { results } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, name, description, category, active, created_at
       FROM ${TABLE}
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC
       LIMIT 200`,
    )
    .bind(tenantId, saasId)
    .all<ServiceRow>();
  return (results ?? []).map(rowToService);
}

async function getServiceById(
  id: string,
  tenantId: string,
  saasId: string,
): Promise<EmpresaService | null> {
  const db = await getDb(tenantId, saasId);
  const row = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, name, description, category, active, created_at
       FROM ${TABLE}
       WHERE id = ? AND tenant_id = ? AND saas_id = ?`,
    )
    .bind(id, tenantId, saasId)
    .first<ServiceRow>();
  return row ? rowToService(row) : null;
}

export async function createService(
  tenantId: string,
  saasId: string,
  input: CreateServiceInput,
): Promise<EmpresaService> {
  const db = await getDb(tenantId, saasId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const active = input.active ?? true;

  await db
    .prepare(
      `INSERT INTO ${TABLE} (id, tenant_id, saas_id, name, description, category, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      saasId,
      input.name,
      input.description ?? null,
      input.category ?? null,
      active ? 1 : 0,
      now,
    )
    .run();

  return {
    id,
    tenantId,
    saasId,
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? null,
    active,
    createdAt: now,
  };
}

export async function updateService(
  id: string,
  tenantId: string,
  saasId: string,
  input: UpdateServiceInput,
): Promise<EmpresaService | null> {
  const db = await getDb(tenantId, saasId);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description);
  }
  if (input.category !== undefined) {
    fields.push("category = ?");
    values.push(input.category);
  }
  if (input.active !== undefined) {
    fields.push("active = ?");
    values.push(input.active ? 1 : 0);
  }

  if (!fields.length) {
    return getServiceById(id, tenantId, saasId);
  }

  values.push(id, tenantId, saasId);
  await db
    .prepare(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ? AND saas_id = ?`)
    .bind(...values)
    .run();

  return getServiceById(id, tenantId, saasId);
}

export async function deleteService(
  id: string,
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  const db = await getDb(tenantId, saasId);
  const result = await db
    .prepare(`DELETE FROM ${TABLE} WHERE id = ? AND tenant_id = ? AND saas_id = ?`)
    .bind(id, tenantId, saasId)
    .run();
  return ((result?.meta as { changes?: number })?.changes ?? 0) > 0;
}

// Returns a structured context string for injection into the LLaVA image-analysis
// prompt, so it can name a service instead of a generic description. Mismo patrón
// que getEmployeeContext (employees/repository.ts).
export async function getServiceContext(tenantId: string, saasId: string): Promise<string> {
  const services = await getServicesByTenant(tenantId, saasId);
  const active = services.filter((s) => s.active);
  if (!active.length) return "";

  const entries = active.map((s) => {
    const category = s.category ? ` (${s.category})` : "";
    const description = s.description ? ` ${s.description}` : "";
    return `${s.name}${category}.${description}`;
  });

  return `Los servicios del negocio son: ${entries.join(" ")}`;
}
