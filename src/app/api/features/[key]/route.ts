import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleFeaturesApiError } from "@/lib/features/api-helpers";
import { getSaasFeatureByKey, resolveFeaturesContext, upsertSaasFeature } from "@/lib/features/repository";
import type { SaasFeatureKey, SaasFeatureSource, SaasFeatureStatus } from "@/lib/features/types";
// export const runtime = "edge"; // OpenNext: disabled for bundling


type RouteContext = {
  params: Promise<{ key: string }>;
};

const STATUS_VALUES: SaasFeatureStatus[] = ["ENABLED", "DISABLED", "PLANNED", "DEPRECATED"];
const SOURCE_VALUES: SaasFeatureSource[] = ["BLUEPRINT", "MANUAL", "AUTOPILOT", "PLAN"];

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { key } = await params;
    if (!saasId || !key) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and key are required" }, { status: 400 });
    }
    const body = (await request.json().catch(() => null)) as {
      status?: SaasFeatureStatus;
      source?: SaasFeatureSource;
    } | null;
    if (!body || (!body.status && !body.source)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "status or source is required" }, { status: 400 });
    }
    if (body.status && !STATUS_VALUES.includes(body.status)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "status no es válido" }, { status: 400 });
    }
    if (body.source && !SOURCE_VALUES.includes(body.source)) {
      return NextResponse.json({ code: "INVALID_BODY", message: "source no es válido" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveFeaturesContext({ tenantId, saasId });
    const current = await getSaasFeatureByKey(ctx, key as SaasFeatureKey);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Feature not found" }, { status: 404 });
    }
    const feature = await upsertSaasFeature(ctx, {
      tenantId,
      saasId,
      featureKey: current.featureKey,
      status: body.status ?? current.status,
      source: body.source ?? current.source,
    });
    return NextResponse.json({ feature });
  } catch (error) {
    return handleFeaturesApiError("FEATURES_PATCH", error);
  }
}
