import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { getDemoSaasPackForSaas } from "@/lib/admin/demo-data";
import { resolveBlueprintsContext, getSaasBlueprint } from "@/lib/blueprints/repository";
import { resolveFeaturesContext, listSaasFeatures } from "@/lib/features/repository";
import { resolveEconomyContext, listSaasServices } from "@/lib/economy/repository";
import { guessPackForSaas } from "@/lib/packs/repository";
export const runtime = "edge";


export async function GET(request: Request) {
  const url = new URL(request.url);
  const saasId = url.searchParams.get("saasId");
  if (!saasId) {
    return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
  }
  const { tenantId } = await requireTenantAccess(request);

  const demoPack = getDemoSaasPackForSaas(saasId);
  if (demoPack) {
    return NextResponse.json({ pack: demoPack, reason: "MATCHED_BY_DEMO" });
  }

  let businessType: string | null = null;
  try {
    const blueprintsCtx = await resolveBlueprintsContext({ tenantId, saasId });
    const blueprint = await getSaasBlueprint(blueprintsCtx, saasId);
    businessType = blueprint?.businessType ?? null;
  } catch {
    businessType = null;
  }

  let featureKeys: string[] = [];
  try {
    const featuresCtx = await resolveFeaturesContext({ tenantId, saasId });
    const features = await listSaasFeatures(featuresCtx);
    featureKeys = features.map((feature) => feature.featureKey);
  } catch {
    featureKeys = [];
  }

  let serviceNames: string[] = [];
  try {
    const economyCtx = await resolveEconomyContext({ tenantId, saasId });
    const services = await listSaasServices(economyCtx);
    serviceNames = services.map((service) => service.name);
  } catch {
    serviceNames = [];
  }

  const pack = guessPackForSaas({ businessType, featureKeys, serviceNames });
  return NextResponse.json({
    pack,
    reason: pack ? (businessType ? "MATCHED_BY_BLUEPRINT" : "MATCHED_BY_FEATURES") : "NO_MATCH",
  });
}
