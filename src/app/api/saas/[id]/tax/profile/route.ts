import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { handleTaxApiError } from "@/lib/tax/api-helpers";
import { DEFAULT_TAX_PROFILE } from "@/lib/tax/engine";
import { resolveTaxContext, getSaasTaxProfile, upsertSaasTaxProfile } from "@/lib/tax/repository";
export const runtime = "edge";


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: saasId } = await params;
    const ctx = await resolveTaxContext({ tenantId, saasId });
    let profile = await getSaasTaxProfile(ctx);
    if (!profile) {
      profile = await upsertSaasTaxProfile(ctx, {
        saasId,
        ...DEFAULT_TAX_PROFILE,
      });
    }
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return handleTaxApiError(error);
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: saasId } = await params;
    const body = (await request.json().catch(() => null)) as
      | {
          country?: string;
          region?: string | null;
          regime?: string;
          defaultVatRate?: number;
          reducedVatRate?: number | null;
          superReducedVatRate?: number | null;
          usesWithholding?: boolean;
          withholdingRate?: number;
          incomeTaxMode?: string;
        }
      | null;
    const ctx = await resolveTaxContext({ tenantId, saasId });
    const existing = await getSaasTaxProfile(ctx);
    const profile = await upsertSaasTaxProfile(ctx, {
      saasId,
      country: body?.country ?? existing?.country ?? DEFAULT_TAX_PROFILE.country,
      region: typeof body?.region !== "undefined" ? body.region : existing?.region ?? DEFAULT_TAX_PROFILE.region,
      regime: body?.regime ?? existing?.regime ?? DEFAULT_TAX_PROFILE.regime,
      defaultVatRate: typeof body?.defaultVatRate === "number" ? body.defaultVatRate : existing?.defaultVatRate ?? DEFAULT_TAX_PROFILE.defaultVatRate,
      reducedVatRate:
        typeof body?.reducedVatRate !== "undefined"
          ? body.reducedVatRate
          : existing?.reducedVatRate ?? DEFAULT_TAX_PROFILE.reducedVatRate,
      superReducedVatRate:
        typeof body?.superReducedVatRate !== "undefined"
          ? body.superReducedVatRate
          : existing?.superReducedVatRate ?? DEFAULT_TAX_PROFILE.superReducedVatRate,
      usesWithholding: typeof body?.usesWithholding === "boolean" ? body.usesWithholding : existing?.usesWithholding ?? DEFAULT_TAX_PROFILE.usesWithholding,
      withholdingRate:
        typeof body?.withholdingRate === "number" ? body.withholdingRate : existing?.withholdingRate ?? DEFAULT_TAX_PROFILE.withholdingRate,
      incomeTaxMode: body?.incomeTaxMode ?? existing?.incomeTaxMode ?? DEFAULT_TAX_PROFILE.incomeTaxMode,
      metadata: existing?.metadata ?? DEFAULT_TAX_PROFILE.metadata,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return handleTaxApiError(error);
  }
}
