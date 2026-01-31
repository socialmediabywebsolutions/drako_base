import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleBlueprintsApiError } from "@/lib/blueprints/api-helpers";
import { getSaasBlueprint, listSaasModules, resolveBlueprintsContext, upsertSaasBlueprint } from "@/lib/blueprints/repository";
// export const runtime = "edge"; // OpenNext Migration


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveBlueprintsContext({ tenantId, saasId });
    const [blueprint, modules] = await Promise.all([
      getSaasBlueprint(ctx, saasId),
      listSaasModules(ctx, saasId),
    ]);
    return NextResponse.json({ blueprint, modules });
  } catch (error) {
    return handleBlueprintsApiError("BLUEPRINT_GET", error, "BLUEPRINT_GET_ERROR");
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      businessType?: string;
      primaryGoal?: string;
      maturityStage?: string;
      notes?: string | null;
    } | null;
    if (!body?.saasId || !body.businessType || !body.primaryGoal || !body.maturityStage) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, businessType, primaryGoal and maturityStage are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveBlueprintsContext({ tenantId, saasId: body.saasId });
    const blueprint = await upsertSaasBlueprint(ctx, {
      saasId: body.saasId,
      businessType: body.businessType as "SALON" | "CLINIC" | "LAUNDRY" | "PET_CARE" | "OTHER",
      primaryGoal: body.primaryGoal as "FILL_AGENDA" | "MAX_MARGIN" | "SCALE" | "STABILIZE",
      maturityStage: body.maturityStage as "STARTER" | "GROWTH" | "PRO" | "MULTI_SITE",
      notes: body.notes ?? null,
    });
    return NextResponse.json({ blueprint });
  } catch (error) {
    return handleBlueprintsApiError("BLUEPRINT_POST", error, "BLUEPRINT_POST_ERROR");
  }
}
