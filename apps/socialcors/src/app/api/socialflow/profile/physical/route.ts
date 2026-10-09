export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialContextError } from "@/lib/socialflow/repository";
import {
  getPhysicalProfile,
  upsertPhysicalProfile,
  type BodyType,
  type HairLength,
  type HairTexture,
  type Gender,
  type CupSize,
  type BodyConstitution,
  type FaceShape,
  type EyeColor,
  type Beard,
  type PhysicalProfilePatch,
} from "@/lib/socialflow/profile/physical-repository";

const DEFAULT_SAAS_ID = "socialflow";

const BODY_TYPES: BodyType[] = ["atletica", "fibrada", "normal", "curvilinea", "musculosa"];
const HAIR_LENGTHS: HairLength[] = ["rapado", "muy_corto", "corto", "medio", "largo", "muy_largo"];
const HAIR_TEXTURES: HairTexture[] = ["liso", "ondulado", "rizado", "muy_rizado", "con_mechas", "con_highlights"];
const GENDERS: Gender[] = ["mujer", "hombre", "no_binario", "prefiero_no_decir"];
const CUP_SIZES: CupSize[] = ["AA", "A", "B", "C", "D", "DD", "E", "F"];
const BODY_CONSTITUTIONS: BodyConstitution[] = ["ectomorfo", "mesomorfo", "endomorfo", "mixto"];
const FACE_SHAPES: FaceShape[] = ["ovalada", "redonda", "cuadrada", "corazon", "alargada"];
const EYE_COLORS: EyeColor[] = ["marrones", "verdes", "azules", "grises", "miel", "negros", "heterocromia"];
const BEARDS: Beard[] = ["sin_barba", "corta", "larga", "bigote"];

const FITNESS_STYLE_VALUES = [
  "fitness",
  "lifestyle",
  "gym",
  "fitness_model",
  "crossfit",
  "yoga",
  "pilates",
  "running",
  "nutricion",
  "wellness",
];
const SKIN_TONE_VALUES = ["muy_clara", "clara", "media", "olivacea", "morena", "oscura", "muy_oscura"];
const HAIR_COLOR_BASE_VALUES = [
  "negro",
  "castano_oscuro",
  "castano",
  "castano_claro",
  "rubio_oscuro",
  "rubio",
  "rubio_platino",
  "pelirrojo",
  "canoso",
  "rapado_sin_cabello",
];
const HAIR_STYLE_VALUES = [
  "sin_tratamiento",
  "mechas_californianas",
  "mechas_babylights",
  "mechas_balayage",
  "mechas_de_color",
  "ombre",
  "highlights",
  "tenido_fantasia",
];
const CONTENT_VISUAL_STYLE_VALUES = [
  "minimalista",
  "colorido_vibrante",
  "oscuro_moody",
  "natural_sin_filtros",
  "glamuroso",
  "deportivo_raw",
  "profesional_limpio",
];
const TATTOOS_VALUES = [
  "sin_tatuajes",
  "pequenos_discretos",
  "brazo",
  "espalda",
  "cuello_manos",
  "muy_tatuado",
];

function resolveSaasId(request: Request): string {
  const requestUrl = new URL(request.url);
  return requestUrl.searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function parseStringArray(value: unknown, allowed: readonly string[]): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((v): v is string => typeof v === "string" && allowed.includes(v));
  return items.length ? items : null;
}

function parsePatch(body: Record<string, unknown>): PhysicalProfilePatch {
  return {
    referenceImageUrl: typeof body.referenceImageUrl === "string" ? body.referenceImageUrl : null,
    gender: parseEnum(body.gender, GENDERS),
    heightCm: typeof body.heightCm === "number" ? body.heightCm : null,
    weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
    bodyType: parseEnum(body.bodyType, BODY_TYPES),
    bodyConstitution: parseEnum(body.bodyConstitution, BODY_CONSTITUTIONS),
    chestCm: typeof body.chestCm === "number" ? body.chestCm : null,
    cupSize: parseEnum(body.cupSize, CUP_SIZES),
    waistCm: typeof body.waistCm === "number" ? body.waistCm : null,
    hipsCm: typeof body.hipsCm === "number" ? body.hipsCm : null,
    fitnessStyles: parseStringArray(body.fitnessStyles, FITNESS_STYLE_VALUES),
    skinTone: parseEnum(body.skinTone, SKIN_TONE_VALUES),
    hairColorBase: parseEnum(body.hairColorBase, HAIR_COLOR_BASE_VALUES),
    hairStyle: parseEnum(body.hairStyle, HAIR_STYLE_VALUES),
    hairLength: parseEnum(body.hairLength, HAIR_LENGTHS),
    hairTexture: parseEnum(body.hairTexture, HAIR_TEXTURES),
    faceShape: parseEnum(body.faceShape, FACE_SHAPES),
    eyeColor: parseEnum(body.eyeColor, EYE_COLORS),
    contentVisualStyle: parseStringArray(body.contentVisualStyle, CONTENT_VISUAL_STYLE_VALUES),
    tattoos: parseEnum(body.tattoos, TATTOOS_VALUES),
    beard: parseEnum(body.beard, BEARDS),
    referenceFaceR2Key: typeof body.referenceFaceR2Key === "string" ? body.referenceFaceR2Key : null,
    extraNotes: typeof body.extraNotes === "string" ? body.extraNotes : null,
  };
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);
    const profile = await getPhysicalProfile(session.tenantId, saasId);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PHYSICAL_PROFILE_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load physical profile" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const saasId = resolveSaasId(request);
    const patch = parsePatch(body);
    const profile = await upsertPhysicalProfile(session.tenantId, patch, saasId);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_PHYSICAL_PROFILE_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to save physical profile" }, { status: 500 });
  }
}
