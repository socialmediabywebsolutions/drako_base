import { resolveSocialContext } from "@/lib/socialflow/repository";

const TABLE = "socialcors_physical_profile";
const DEFAULT_SAAS_ID = "socialflow";

export type BodyType = "atletica" | "fibrada" | "normal" | "curvilinea" | "musculosa";
export type FitnessStyle = "competicion" | "funcional" | "crossfit" | "yoga" | "pilates" | "lifestyle" | "running";
export type HairLength = "corto" | "medio" | "largo";

export type PhysicalProfile = {
  id: string;
  tenantId: string;
  referenceImageUrl: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bodyType: BodyType | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  fitnessStyle: FitnessStyle | null;
  fitnessStyles: string[] | null;
  skinTone: string | null;
  hairColor: string | null;
  hairLength: HairLength | null;
  extraNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

type PhysicalProfileRow = {
  id: string;
  tenant_id: string;
  reference_image_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  fitness_style: string | null;
  fitness_styles_json: string | null;
  skin_tone: string | null;
  hair_color: string | null;
  hair_length: string | null;
  extra_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PhysicalProfilePatch = {
  referenceImageUrl?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  bodyType?: BodyType | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  fitnessStyle?: FitnessStyle | null;
  fitnessStyles?: string[] | null;
  skinTone?: string | null;
  hairColor?: string | null;
  hairLength?: HairLength | null;
  extraNotes?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  try {
    if (globalThis.crypto?.randomUUID) return `sf_physical_${globalThis.crypto.randomUUID()}`;
  } catch {
    // ignore and fallback
  }
  return `sf_physical_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeNullableString(value: unknown): string | null {
  const str = typeof value === "string" ? value.trim() : "";
  return str ? str : null;
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseFitnessStylesJson(value: string | null): string[] | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : null;
  } catch {
    return null;
  }
}

function rowToProfile(row: PhysicalProfileRow): PhysicalProfile {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    referenceImageUrl: row.reference_image_url,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    bodyType: (row.body_type as BodyType | null) ?? null,
    chestCm: row.chest_cm,
    waistCm: row.waist_cm,
    hipsCm: row.hips_cm,
    fitnessStyle: (row.fitness_style as FitnessStyle | null) ?? null,
    fitnessStyles: parseFitnessStylesJson(row.fitness_styles_json),
    skinTone: row.skin_tone,
    hairColor: row.hair_color,
    hairLength: (row.hair_length as HairLength | null) ?? null,
    extraNotes: row.extra_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPhysicalProfile(tenantId: string, saasId: string = DEFAULT_SAAS_ID): Promise<PhysicalProfile | null> {
  const context = await resolveSocialContext({ tenantId, saasId });
  const result = await context.socialDb
    .prepare(`SELECT * FROM ${TABLE} WHERE tenant_id = ? LIMIT 1`)
    .bind(context.tenantId)
    .all<PhysicalProfileRow>();
  const row = result.results?.[0] ?? null;
  return row ? rowToProfile(row) : null;
}

export async function upsertPhysicalProfile(
  tenantId: string,
  patch: PhysicalProfilePatch,
  saasId: string = DEFAULT_SAAS_ID,
): Promise<PhysicalProfile> {
  const context = await resolveSocialContext({ tenantId, saasId });
  const existing = await getPhysicalProfile(context.tenantId, saasId);
  const id = existing?.id ?? generateId();
  const updatedAt = nowIso();

  // fitness_style (legacy, single-select) ya no lo escribe la UI — si el patch no lo
  // trae explícito, se conserva el valor existente en vez de vaciarlo.
  const fitnessStyle = patch.fitnessStyle !== undefined ? normalizeNullableString(patch.fitnessStyle) : existing?.fitnessStyle ?? null;
  const fitnessStylesJson = patch.fitnessStyles !== undefined && patch.fitnessStyles !== null ? JSON.stringify(patch.fitnessStyles) : null;

  await context.socialDb
    .prepare(
      `INSERT INTO ${TABLE} (
        id, tenant_id, reference_image_url, height_cm, weight_kg, body_type,
        chest_cm, waist_cm, hips_cm, fitness_style, fitness_styles_json, skin_tone, hair_color, hair_length,
        extra_notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        reference_image_url = excluded.reference_image_url,
        height_cm = excluded.height_cm,
        weight_kg = excluded.weight_kg,
        body_type = excluded.body_type,
        chest_cm = excluded.chest_cm,
        waist_cm = excluded.waist_cm,
        hips_cm = excluded.hips_cm,
        fitness_style = excluded.fitness_style,
        fitness_styles_json = excluded.fitness_styles_json,
        skin_tone = excluded.skin_tone,
        hair_color = excluded.hair_color,
        hair_length = excluded.hair_length,
        extra_notes = excluded.extra_notes,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      context.tenantId,
      normalizeNullableString(patch.referenceImageUrl),
      normalizeNullableNumber(patch.heightCm),
      normalizeNullableNumber(patch.weightKg),
      normalizeNullableString(patch.bodyType),
      normalizeNullableNumber(patch.chestCm),
      normalizeNullableNumber(patch.waistCm),
      normalizeNullableNumber(patch.hipsCm),
      fitnessStyle,
      fitnessStylesJson,
      normalizeNullableString(patch.skinTone),
      normalizeNullableString(patch.hairColor),
      normalizeNullableString(patch.hairLength),
      normalizeNullableString(patch.extraNotes),
      existing?.createdAt ?? updatedAt,
      updatedAt,
    )
    .run();

  const saved = await getPhysicalProfile(context.tenantId, saasId);
  if (!saved) throw new Error("Failed to persist physical profile");
  return saved;
}
