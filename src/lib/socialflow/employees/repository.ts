import { resolveSocialContext } from "@/lib/socialflow/repository";
import type { EmpresaEmployee, CreateEmployeeInput, UpdateEmployeeInput } from "./types";

const TABLE = "saas_empresa_employees";

type EmployeeRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  role: string | null;
  specialty: string | null;
  description: string | null;
  photo_url: string | null;
  face_r2_key: string | null;
  active: number;
  created_at: string;
};

function rowToEmployee(row: EmployeeRow): EmpresaEmployee {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    name: row.name,
    role: row.role,
    specialty: row.specialty,
    description: row.description,
    photoUrl: row.photo_url,
    faceR2Key: row.face_r2_key,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

async function getDb(tenantId: string, saasId: string) {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  return ctx.socialDb;
}

export async function getEmployeesByTenant(
  tenantId: string,
  saasId: string,
): Promise<EmpresaEmployee[]> {
  const db = await getDb(tenantId, saasId);
  const { results } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, name, role, specialty, description, photo_url, face_r2_key, active, created_at
       FROM ${TABLE}
       WHERE tenant_id = ? AND saas_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 200`,
    )
    .bind(tenantId, saasId)
    .all<EmployeeRow>();
  return (results ?? []).map(rowToEmployee);
}

async function getEmployeeById(
  id: string,
  tenantId: string,
  saasId: string,
): Promise<EmpresaEmployee | null> {
  const db = await getDb(tenantId, saasId);
  const row = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, name, role, specialty, description, photo_url, face_r2_key, active, created_at
       FROM ${TABLE}
       WHERE id = ? AND tenant_id = ? AND saas_id = ? AND deleted_at IS NULL`,
    )
    .bind(id, tenantId, saasId)
    .first<EmployeeRow>();
  return row ? rowToEmployee(row) : null;
}

export async function createEmployee(
  tenantId: string,
  saasId: string,
  input: CreateEmployeeInput,
): Promise<EmpresaEmployee> {
  const db = await getDb(tenantId, saasId);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const active = input.active ?? true;

  await db
    .prepare(
      `INSERT INTO ${TABLE} (id, tenant_id, saas_id, name, role, specialty, description, photo_url, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      saasId,
      input.name,
      input.role ?? null,
      input.specialty ?? null,
      input.description ?? null,
      input.photoUrl ?? null,
      active ? 1 : 0,
      now,
    )
    .run();

  return {
    id,
    tenantId,
    saasId,
    name: input.name,
    role: input.role ?? null,
    specialty: input.specialty ?? null,
    description: input.description ?? null,
    photoUrl: input.photoUrl ?? null,
    faceR2Key: null,
    active,
    createdAt: now,
  };
}

export async function updateEmployee(
  id: string,
  tenantId: string,
  saasId: string,
  input: UpdateEmployeeInput,
): Promise<EmpresaEmployee | null> {
  const db = await getDb(tenantId, saasId);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    fields.push("name = ?");
    values.push(input.name);
  }
  if (input.role !== undefined) {
    fields.push("role = ?");
    values.push(input.role);
  }
  if (input.specialty !== undefined) {
    fields.push("specialty = ?");
    values.push(input.specialty);
  }
  if (input.description !== undefined) {
    fields.push("description = ?");
    values.push(input.description);
  }
  if (input.photoUrl !== undefined) {
    fields.push("photo_url = ?");
    values.push(input.photoUrl);
  }
  if (input.faceR2Key !== undefined) {
    fields.push("face_r2_key = ?");
    values.push(input.faceR2Key);
  }
  if (input.active !== undefined) {
    fields.push("active = ?");
    values.push(input.active ? 1 : 0);
  }

  if (!fields.length) {
    return getEmployeeById(id, tenantId, saasId);
  }

  values.push(id, tenantId, saasId);
  await db
    .prepare(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ? AND saas_id = ? AND deleted_at IS NULL`)
    .bind(...values)
    .run();

  return getEmployeeById(id, tenantId, saasId);
}

export async function deleteEmployee(
  id: string,
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  const db = await getDb(tenantId, saasId);
  const result = await db
    .prepare(`UPDATE ${TABLE} SET deleted_at = datetime('now') WHERE id = ? AND tenant_id = ? AND saas_id = ? AND deleted_at IS NULL`)
    .bind(id, tenantId, saasId)
    .run();
  return ((result?.meta as { changes?: number })?.changes ?? 0) > 0;
}

// Returns a structured context string for injection into the LLaVA image-analysis
// prompt, so it can name an employee instead of a generic role ("nuestra estilista").
export async function getEmployeeContext(tenantId: string, saasId: string): Promise<string> {
  const employees = await getEmployeesByTenant(tenantId, saasId);
  const active = employees.filter((e) => e.active);
  if (!active.length) return "";

  const entries = active.map((e) => {
    const roleSpecialty = [e.role, e.specialty ? `especialidad: ${e.specialty}` : null]
      .filter(Boolean)
      .join(", ");
    const parenthetical = roleSpecialty ? ` (${roleSpecialty})` : "";
    const description = e.description ? ` ${e.description}` : "";
    return `${e.name}${parenthetical}.${description}`;
  });

  return `Los empleados del negocio son: ${entries.join(" ")}`;
}
