import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleFeaturesApiError } from "@/lib/features/api-helpers";
import { listSaasFeatures, resolveFeaturesContext, upsertSaasFeature } from "@/lib/features/repository";
import type { SaasFeatureCategory, SaasFeatureKey, SaasFeatureSource, SaasFeatureStatus } from "@/lib/features/types";


const FEATURE_KEYS: SaasFeatureKey[] = [
  "ECONOMY",
  "HR",
  "EMPLOYEES",
  "STAFF_PORTAL",
  "CLIENT_PORTAL",
  "EMAIL_INTAKE",
  "SOCIAL",
  "OWNER_CONTROL",
  "TASKS",
  "KNOWLEDGE",
  "BLUEPRINT",
];

const CATEGORY_VALUES: SaasFeatureCategory[] = ["CORE", "OPERATIONS", "MARKETING", "ANALYTICS"];
const STATUS_VALUES: SaasFeatureStatus[] = ["ENABLED", "DISABLED", "PLANNED", "DEPRECATED"];
const SOURCE_VALUES: SaasFeatureSource[] = ["BLUEPRINT", "MANUAL", "AUTOPILOT", "PLAN"];

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveFeaturesContext({ tenantId, saasId });
    const items = await listSaasFeatures(ctx);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleFeaturesApiError("FEATURES_LIST", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      featureKey?: SaasFeatureKey;
      label?: string;
      category?: SaasFeatureCategory;
      status?: SaasFeatureStatus;
      source?: SaasFeatureSource;
      phaseOrder?: number;
      metadata?: Record<string, unknown> | null;
    } | null;
    if (!body?.saasId || !body.featureKey) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId and featureKey are required" }, { status: 400 });
    }
    if (!FEATURE_KEYS.includes(body.featureKey)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "featureKey no es válido" }, { status: 400 });
    }
    if (body.category && !CATEGORY_VALUES.includes(body.category)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "category no es válido" }, { status: 400 });
    }
    if (body.status && !STATUS_VALUES.includes(body.status)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "status no es válido" }, { status: 400 });
    }
    if (body.source && !SOURCE_VALUES.includes(body.source)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "source no es válido" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveFeaturesContext({ tenantId, saasId: body.saasId });
    const feature = await upsertSaasFeature(ctx, {
      tenantId,
      saasId: body.saasId,
      featureKey: body.featureKey,
      label: body.label,
      category: body.category,
      status: body.status,
      source: body.source,
      phaseOrder: body.phaseOrder,
      metadata: body.metadata ?? null,
    });
    return NextResponse.json({ feature });
  } catch (error) {
    return handleFeaturesApiError("FEATURES_UPSERT", error);
  }
}
