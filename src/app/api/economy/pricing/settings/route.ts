import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEconomyApiError } from "@/lib/economy/api-helpers";
import { getSaasPricingSettings, resolveEconomyContext, upsertSaasPricingSettings } from "@/lib/economy/repository";
export const runtime = "edge";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId });
    const settings = await getSaasPricingSettings(context);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_PRICING_SETTINGS_GET", error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string;
      targetMarginPercent?: number;
      minMarginPercent?: number;
      occupancyTargetPercent?: number;
      includePayroll?: boolean;
      includeRent?: boolean;
      includeUtilities?: boolean;
      includeProducts?: boolean;
    } | null;
    if (!body?.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId: body.saasId });
    const current = await getSaasPricingSettings(context);
    const settings = await upsertSaasPricingSettings(context, {
      id: current.id,
      saasId: body.saasId,
      targetMarginPercent: typeof body.targetMarginPercent === "number" ? body.targetMarginPercent : current.targetMarginPercent,
      minMarginPercent: typeof body.minMarginPercent === "number" ? body.minMarginPercent : current.minMarginPercent,
      occupancyTargetPercent:
        typeof body.occupancyTargetPercent === "number" ? body.occupancyTargetPercent : current.occupancyTargetPercent,
      includePayroll: typeof body.includePayroll === "boolean" ? body.includePayroll : current.includePayroll,
      includeRent: typeof body.includeRent === "boolean" ? body.includeRent : current.includeRent,
      includeUtilities: typeof body.includeUtilities === "boolean" ? body.includeUtilities : current.includeUtilities,
      includeProducts: typeof body.includeProducts === "boolean" ? body.includeProducts : current.includeProducts,
    });
    return NextResponse.json({ settings });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_PRICING_SETTINGS_PATCH", error);
  }
}
