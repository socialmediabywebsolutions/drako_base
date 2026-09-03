export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { SocialContextError } from "@/lib/socialflow/repository";
import {
  getPhysicalProfile,
  upsertPhysicalProfile,
  type BodyType,
  type FitnessStyle,
  type HairLength,
  type PhysicalProfilePatch,
} from "@/lib/socialflow/profile/physical-repository";

const DEFAULT_SAAS_ID = "socialflow";

const BODY_TYPES: BodyType[] = ["atletica", "fibrada", "normal", "curvilinea", "musculosa"];
const FITNESS_STYLES: FitnessStyle[] = ["competicion", "funcional", "crossfit", "yoga", "pilates", "lifestyle", "running"];
const HAIR_LENGTHS: HairLength[] = ["corto", "medio", "largo"];

function resolveSaasId(request: Request): string {
  const requestUrl = new URL(request.url);
  return requestUrl.searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

function parsePatch(body: Record<string, unknown>): PhysicalProfilePatch {
  const bodyType = typeof body.bodyType === "string" && BODY_TYPES.includes(body.bodyType as BodyType) ? (body.bodyType as BodyType) : null;
  const fitnessStyle =
    typeof body.fitnessStyle === "string" && FITNESS_STYLES.includes(body.fitnessStyle as FitnessStyle)
      ? (body.fitnessStyle as FitnessStyle)
      : null;
  const hairLength =
    typeof body.hairLength === "string" && HAIR_LENGTHS.includes(body.hairLength as HairLength) ? (body.hairLength as HairLength) : null;

  return {
    referenceImageUrl: typeof body.referenceImageUrl === "string" ? body.referenceImageUrl : null,
    heightCm: typeof body.heightCm === "number" ? body.heightCm : null,
    weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
    bodyType,
    chestCm: typeof body.chestCm === "number" ? body.chestCm : null,
    waistCm: typeof body.waistCm === "number" ? body.waistCm : null,
    hipsCm: typeof body.hipsCm === "number" ? body.hipsCm : null,
    fitnessStyle,
    skinTone: typeof body.skinTone === "string" ? body.skinTone : null,
    hairColor: typeof body.hairColor === "string" ? body.hairColor : null,
    hairLength,
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
