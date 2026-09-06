import { resolveSocialContext } from "@/lib/socialflow/repository";

const TABLE = "socialcors_employee_profiles";
const DEFAULT_SAAS_ID = "socialflow";
export const MAX_EMPLOYEE_PROFILES_PER_TENANT = 20;

export type EmployeeProfile = {
  id: string;
  tenantId: string;
  name: string;
  jobTitle: string;
  jobDescription: string | null;
  faceR2Key: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EmployeeProfileRow = {
  id: string;
  tenant_id: string;
  name: string;
  job_title: string;
  job_description: string | null;
  face_r2_key: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

export type EmployeeProfileInput = {
  name: string;
  jobTitle: string;
  jobDescription?: string | null;
};

export type EmployeeProfilePatch = {
  name?: string;
  jobTitle?: string;
  jobDescription?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  try {
    if (globalThis.crypto?.randomUUID) return `sf_employee_${globalThis.crypto.randomUUID()}`;
  } catch {
    // ignore and fallback
  }
  return `sf_employee_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function rowToProfile(row: EmployeeProfileRow): EmployeeProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    jobTitle: row.job_title,
    jobDescription: row.job_description,
    faceR2Key: row.face_r2_key,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class EmployeeProfileLimitError extends Error {
  constructor() {
    super(`Maximum of ${MAX_EMPLOYEE_PROFILES_PER_TENANT} employee profiles per tenant reached`);
    this.name = "EmployeeProfileLimitError";
  }
}

export async function listActiveEmployeeProfiles(tenantId: string, saasId: string = DEFAULT_SAAS_ID): Promise<EmployeeProfile[]> {
  const context = await resolveSocialContext({ tenantId, saasId });
  const result = await context.socialDb
    .prepare(`SELECT * FROM ${TABLE} WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at ASC`)
    .bind(context.tenantId)
    .all<EmployeeProfileRow>();
  return (result.results ?? []).map(rowToProfile);
}

export async function getEmployeeProfile(id: string, tenantId: string, saasId: string = DEFAULT_SAAS_ID): Promise<EmployeeProfile | null> {
  const context = await resolveSocialContext({ tenantId, saasId });
  const row = await context.socialDb
    .prepare(`SELECT * FROM ${TABLE} WHERE id = ? AND tenant_id = ? LIMIT 1`)
    .bind(id, context.tenantId)
    .first<EmployeeProfileRow>();
  return row ? rowToProfile(row) : null;
}

export async function createEmployeeProfile(
  tenantId: string,
  input: EmployeeProfileInput,
  saasId: string = DEFAULT_SAAS_ID,
): Promise<EmployeeProfile> {
  const context = await resolveSocialContext({ tenantId, saasId });

  const countRow = await context.socialDb
    .prepare(`SELECT COUNT(*) as cnt FROM ${TABLE} WHERE tenant_id = ? AND is_active = 1`)
    .bind(context.tenantId)
    .first<{ cnt: number }>();
  if ((countRow?.cnt ?? 0) >= MAX_EMPLOYEE_PROFILES_PER_TENANT) {
    throw new EmployeeProfileLimitError();
  }

  const id = generateId();
  const now = nowIso();

  await context.socialDb
    .prepare(
      `INSERT INTO ${TABLE} (id, tenant_id, name, job_title, job_description, face_r2_key, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .bind(id, context.tenantId, input.name.trim(), input.jobTitle.trim(), input.jobDescription?.trim() || null, now, now)
    .run();

  return {
    id,
    tenantId: context.tenantId,
    name: input.name.trim(),
    jobTitle: input.jobTitle.trim(),
    jobDescription: input.jobDescription?.trim() || null,
    faceR2Key: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateEmployeeProfile(
  id: string,
  tenantId: string,
  patch: EmployeeProfilePatch,
  saasId: string = DEFAULT_SAAS_ID,
): Promise<EmployeeProfile | null> {
  const context = await resolveSocialContext({ tenantId, saasId });

  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name.trim());
  }
  if (patch.jobTitle !== undefined) {
    fields.push("job_title = ?");
    values.push(patch.jobTitle.trim());
  }
  if (patch.jobDescription !== undefined) {
    fields.push("job_description = ?");
    values.push(patch.jobDescription?.trim() || null);
  }

  if (!fields.length) {
    return getEmployeeProfile(id, tenantId, saasId);
  }

  fields.push("updated_at = ?");
  values.push(nowIso(), id, context.tenantId);

  await context.socialDb
    .prepare(`UPDATE ${TABLE} SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`)
    .bind(...values)
    .run();

  return getEmployeeProfile(id, tenantId, saasId);
}

export async function setEmployeeProfileFaceKey(
  id: string,
  tenantId: string,
  faceR2Key: string,
  saasId: string = DEFAULT_SAAS_ID,
): Promise<EmployeeProfile | null> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await context.socialDb
    .prepare(`UPDATE ${TABLE} SET face_r2_key = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(faceR2Key, nowIso(), id, context.tenantId)
    .run();
  return getEmployeeProfile(id, tenantId, saasId);
}

export async function softDeleteEmployeeProfile(id: string, tenantId: string, saasId: string = DEFAULT_SAAS_ID): Promise<boolean> {
  const context = await resolveSocialContext({ tenantId, saasId });
  const result = await context.socialDb
    .prepare(`UPDATE ${TABLE} SET is_active = 0, updated_at = ? WHERE id = ? AND tenant_id = ? AND is_active = 1`)
    .bind(nowIso(), id, context.tenantId)
    .run();
  return ((result?.meta as { changes?: number })?.changes ?? 0) > 0;
}

// Contexto para el prompt de SDXL (ver image-generator.ts) — distinto de
// getEmployeeContext() en lib/socialflow/employees/repository.ts, que alimenta el
// análisis de imagen LLaVA con texto libre; este produce la lista estructurada
// "Known team members" que el modelo de generación usa para reconocer quién puede
// aparecer en las fotos de una cuenta empresa.
export function buildEmployeeFaceUrl(employee: EmployeeProfile, r2PublicUrl: string | undefined | null): string | null {
  if (!employee.faceR2Key || !r2PublicUrl) return null;
  return `${r2PublicUrl.replace(/\/$/, "")}/${employee.faceR2Key}`;
}

export function describeEmployeeProfilesForPrompt(employees: EmployeeProfile[]): string | null {
  if (!employees.length) return null;
  const entries = employees.map((e) => {
    const description = e.jobDescription ? `: ${e.jobDescription}` : "";
    return `${e.name} (${e.jobTitle})${description}`;
  });
  return `Known team members: ${entries.join("; ")}`;
}
