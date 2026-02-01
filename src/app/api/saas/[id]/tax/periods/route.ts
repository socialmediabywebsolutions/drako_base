import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { handleTaxApiError } from "@/lib/tax/api-helpers";
import { listTaxPeriodsWithSummary, recalculateCurrentQuarter } from "@/lib/tax/engine";
// export const runtime = "edge"; // OpenNext: disabled for bundling


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: saasId } = await params;
    const items = await listTaxPeriodsWithSummary({ tenantId, saasId });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return handleTaxApiError(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: saasId } = await params;
    const period = await recalculateCurrentQuarter({ tenantId, saasId });
    return NextResponse.json({ period });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    return handleTaxApiError(error);
  }
}
