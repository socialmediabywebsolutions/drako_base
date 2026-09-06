import { resolveSocialContext } from "@/lib/socialflow/repository";
import type {
  EmpresaEmployee,
  CreateEmployeeInput,
  UpdateEmployeeInput,
  EmployeeGender,
  EmployeeSkinTone,
  EmployeeHairStyle,
  EmployeeHairLength,
  EmployeeBodyConstitution,
} from "./types";

const TABLE = "saas_empresa_employees";

const SELECT_COLUMNS = `id, tenant_id, saas_id, name, role, specialty, description, photo_url, face_r2_key, active, created_at,
       age, height_cm, weight_kg, gender, skin_tone, hair_color, hair_style, hair_length, eye_color,
       body_constitution, face_shape, tattoos, beard`;

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
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  gender: string | null;
  skin_tone: string | null;
  hair_color: string | null;
  hair_style: string | null;
  hair_length: string | null;
  eye_color: string | null;
  body_constitution: string | null;
  face_shape: string | null;
  tattoos: string | null;
  beard: string | null;
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
    age: row.age,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    gender: (row.gender as EmployeeGender | null) ?? null,
    skinTone: (row.skin_tone as EmployeeSkinTone | null) ?? null,
    hairColor: row.hair_color,
    hairStyle: (row.hair_style as EmployeeHairStyle | null) ?? null,
    hairLength: (row.hair_length as EmployeeHairLength | null) ?? null,
    eyeColor: row.eye_color,
    bodyConstitution: (row.body_constitution as EmployeeBodyConstitution | null) ?? null,
    faceShape: row.face_shape,
    tattoos: row.tattoos,
    beard: row.beard,
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
      `SELECT ${SELECT_COLUMNS}
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
      `SELECT ${SELECT_COLUMNS}
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
      `INSERT INTO ${TABLE} (
        id, tenant_id, saas_id, name, role, specialty, description, photo_url, active, created_at,
        age, height_cm, weight_kg, gender, skin_tone, hair_color, hair_style, hair_length, eye_color,
        body_constitution, face_shape, tattoos, beard
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.age ?? null,
      input.heightCm ?? null,
      input.weightKg ?? null,
      input.gender ?? null,
      input.skinTone ?? null,
      input.hairColor ?? null,
      input.hairStyle ?? null,
      input.hairLength ?? null,
      input.eyeColor ?? null,
      input.bodyConstitution ?? null,
      input.faceShape ?? null,
      input.tattoos ?? null,
      input.beard ?? null,
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
    age: input.age ?? null,
    heightCm: input.heightCm ?? null,
    weightKg: input.weightKg ?? null,
    gender: input.gender ?? null,
    skinTone: input.skinTone ?? null,
    hairColor: input.hairColor ?? null,
    hairStyle: input.hairStyle ?? null,
    hairLength: input.hairLength ?? null,
    eyeColor: input.eyeColor ?? null,
    bodyConstitution: input.bodyConstitution ?? null,
    faceShape: input.faceShape ?? null,
    tattoos: input.tattoos ?? null,
    beard: input.beard ?? null,
  };
}

const PATCHABLE_COLUMNS: Array<[keyof UpdateEmployeeInput, string]> = [
  ["name", "name"],
  ["role", "role"],
  ["specialty", "specialty"],
  ["description", "description"],
  ["photoUrl", "photo_url"],
  ["faceR2Key", "face_r2_key"],
  ["age", "age"],
  ["heightCm", "height_cm"],
  ["weightKg", "weight_kg"],
  ["gender", "gender"],
  ["skinTone", "skin_tone"],
  ["hairColor", "hair_color"],
  ["hairStyle", "hair_style"],
  ["hairLength", "hair_length"],
  ["eyeColor", "eye_color"],
  ["bodyConstitution", "body_constitution"],
  ["faceShape", "face_shape"],
  ["tattoos", "tattoos"],
  ["beard", "beard"],
];

export async function updateEmployee(
  id: string,
  tenantId: string,
  saasId: string,
  input: UpdateEmployeeInput,
): Promise<EmpresaEmployee | null> {
  const db = await getDb(tenantId, saasId);

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of PATCHABLE_COLUMNS) {
    if (input[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(input[key]);
    }
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
