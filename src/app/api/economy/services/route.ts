import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEconomyApiError } from "@/lib/economy/api-helpers";
import { listSaasServices, resolveEconomyContext, upsertSaasService } from "@/lib/economy/repository";
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
    const items = await listSaasServices(context);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_SERVICES_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string;
      name?: string;
      slug?: string | null;
      category?: string | null;
      durationMinutes?: number;
      currentPrice?: number;
      recommendedPrice?: number | null;
      isActive?: boolean;
      metadata?: Record<string, unknown> | null;
    } | null;
    if (!body?.saasId || !body.name || typeof body.durationMinutes !== "number" || typeof body.currentPrice !== "number") {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, name, durationMinutes, and currentPrice are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId: body.saasId });
    const service = await upsertSaasService(context, {
      id: body.id,
      saasId: body.saasId,
      name: body.name,
      slug: body.slug,
      category: body.category ?? null,
      durationMinutes: body.durationMinutes,
      currentPrice: body.currentPrice,
      recommendedPrice: typeof body.recommendedPrice === "number" ? body.recommendedPrice : null,
      isActive: body.isActive,
      metadata: body.metadata ?? null,
    });
    return NextResponse.json({ service });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_SERVICES_POST", error);
  }
}
