import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleFeaturesApiError } from "@/lib/features/api-helpers";
import { resolveFeaturesContext, syncFeaturesFromBlueprint } from "@/lib/features/repository";
import { listSaasModules, resolveBlueprintsContext } from "@/lib/blueprints/repository";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { saasId?: string | null } | null;
    if (!body?.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const blueprintsCtx = await resolveBlueprintsContext({ tenantId, saasId: body.saasId });
    const modules = await listSaasModules(blueprintsCtx, body.saasId);
    const featuresCtx = await resolveFeaturesContext({ tenantId, saasId: body.saasId });
    const items = await syncFeaturesFromBlueprint(featuresCtx, modules);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleFeaturesApiError("FEATURES_SYNC_BLUEPRINT", error);
  }
}
