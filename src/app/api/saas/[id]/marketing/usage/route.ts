export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { recordMarketingUsage, resolveSaasMarketingContext } from "@/lib/saas/marketing-repository";



type RouteContext = {
  params: Promise<{ id: string }>;
};

function resolveMonthYear(): { month: number; year: number } {
  const now = new Date();
  return { month: now.getUTCMonth() + 1, year: now.getUTCFullYear() };
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: saasId } = await params;
    const body = (await request.json().catch(() => null)) as
      | {
          postsDelta?: number;
          campaignsDelta?: number;
          source?: "AUTOPILOT" | "STAFF" | "IMPORT";
          metadata?: Record<string, unknown> | null;
        }
      | null;
    const ctx = await resolveSaasMarketingContext({ tenantId });
    const { month, year } = resolveMonthYear();
    const record = await recordMarketingUsage(ctx, {
      saasId,
      month,
      year,
      postsDelta: body?.postsDelta,
      campaignsDelta: body?.campaignsDelta,
      source: body?.source ?? "STAFF",
      metadata: body?.metadata ?? null,
    });
    return NextResponse.json({ record });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SAAS_MARKETING_USAGE_ERROR", error);
    return NextResponse.json({ code: "SAAS_MARKETING_USAGE_ERROR", message: "No se pudo registrar el uso de marketing" }, { status: 500 });
  }
}
