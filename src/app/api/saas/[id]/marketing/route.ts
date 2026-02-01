import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  getSaasMarketingPlan,
  getSaasMarketingSnapshotForMonth,
  resolveSaasMarketingContext,
  upsertSaasMarketingPlan,
} from "@/lib/saas/marketing-repository";
// export const runtime = "edge"; // OpenNext: disabled for bundling


type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseMonthYear(request: Request): { month: number; year: number } {
  const now = new Date();
  const url = new URL(request.url);
  const monthParam = Number(url.searchParams.get("month"));
  const yearParam = Number(url.searchParams.get("year"));
  const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12 ? monthParam : now.getUTCMonth() + 1;
  const year = Number.isFinite(yearParam) && yearParam >= 2000 ? yearParam : now.getUTCFullYear();
  return { month, year };
}

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: saasId } = await params;
    const ctx = await resolveSaasMarketingContext({ tenantId });
    const { month, year } = parseMonthYear(request);
    const marketing = await getSaasMarketingSnapshotForMonth(ctx, saasId, { month, year });
    return NextResponse.json({ marketing });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SAAS_MARKETING_SNAPSHOT_ERROR", error);
    return NextResponse.json({ code: "SAAS_MARKETING_SNAPSHOT_ERROR", message: "No se pudo cargar el marketing del SaaS" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const { id: saasId } = await params;
    const body = (await request.json().catch(() => null)) as
      | {
          includedPostsPerMonth?: number;
          includedCampaignsPerMonth?: number;
          extraPostPrice?: number;
          extraCampaignPrice?: number;
          notes?: string | null;
        }
      | null;
    const ctx = await resolveSaasMarketingContext({ tenantId });
    const existing = await getSaasMarketingPlan(ctx, saasId);
    const plan = await upsertSaasMarketingPlan(ctx, {
      id: existing?.id,
      saasId,
      includedPostsPerMonth: Math.max(0, body?.includedPostsPerMonth ?? existing?.includedPostsPerMonth ?? 8),
      includedCampaignsPerMonth: Math.max(0, body?.includedCampaignsPerMonth ?? existing?.includedCampaignsPerMonth ?? 0),
      extraPostPrice: Math.max(0, body?.extraPostPrice ?? existing?.extraPostPrice ?? 0),
      extraCampaignPrice: Math.max(0, body?.extraCampaignPrice ?? existing?.extraCampaignPrice ?? 0),
      notes: typeof body?.notes !== "undefined" ? body.notes : existing?.notes ?? null,
    });
    const { month, year } = parseMonthYear(request);
    const marketing = await getSaasMarketingSnapshotForMonth(ctx, saasId, { month, year });
    return NextResponse.json({ plan, marketing });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SAAS_MARKETING_PLAN_ERROR", error);
    return NextResponse.json({ code: "SAAS_MARKETING_PLAN_ERROR", message: "No se pudo guardar el plan de marketing" }, { status: 500 });
  }
}
