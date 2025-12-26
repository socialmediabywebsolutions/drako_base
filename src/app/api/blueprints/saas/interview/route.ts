import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleBlueprintsApiError } from "@/lib/blueprints/api-helpers";
import { applyInterviewToBlueprint, resolveBlueprintsContext } from "@/lib/blueprints/repository";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      businessType?: string;
      staffCount?: number;
      averageTicket?: number;
      hasSocial?: boolean;
      hasEmailIntake?: boolean;
      mainPain?: string;
      primaryGoal?: string;
      maturityStage?: string;
    } | null;
    if (!body?.saasId || !body.businessType || !body.primaryGoal || !body.maturityStage || !body.mainPain) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, businessType, primaryGoal, maturityStage and mainPain are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveBlueprintsContext({ tenantId, saasId: body.saasId });
    const payload = {
      businessType: body.businessType as "SALON" | "CLINIC" | "LAUNDRY" | "PET_CARE" | "OTHER",
      staffCount: Number.isFinite(body.staffCount) ? Number(body.staffCount) : 0,
      averageTicket: Number.isFinite(body.averageTicket) ? Number(body.averageTicket) : 0,
      hasSocial: Boolean(body.hasSocial),
      hasEmailIntake: Boolean(body.hasEmailIntake),
      mainPain: body.mainPain,
      primaryGoal: body.primaryGoal as "FILL_AGENDA" | "MAX_MARGIN" | "SCALE" | "STABILIZE",
      maturityStage: body.maturityStage as "STARTER" | "GROWTH" | "PRO" | "MULTI_SITE",
    };
    const result = await applyInterviewToBlueprint(ctx, body.saasId, payload);
    return NextResponse.json(result);
  } catch (error) {
    return handleBlueprintsApiError("BLUEPRINT_INTERVIEW_POST", error, "BLUEPRINT_INTERVIEW_ERROR");
  }
}
