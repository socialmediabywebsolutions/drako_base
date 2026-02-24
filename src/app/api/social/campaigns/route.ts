export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listSaasSocialCampaigns, resolveSocialContext, SocialContextError, upsertSaasSocialCampaign } from "@/lib/social/repository";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const items = await listSaasSocialCampaigns(ctx);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CAMPAIGNS_LIST_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudieron cargar las campañas" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      name?: string;
      objective?: string;
      status?: string;
      targetSegment?: string;
      startDate?: string | null;
      endDate?: string | null;
      budgetEstimate?: number | null;
      notes?: string | null;
    } | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const saasId = body.saasId ?? null;
    if (!saasId || !body.name || !body.objective || !body.status || !body.targetSegment) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, name, objective, status, targetSegment are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSocialContext({ tenantId, saasId });
    const status = body.status as "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED";
    const campaign = await upsertSaasSocialCampaign(ctx, {
      id: body.id,
      saasId,
      name: body.name,
      objective: body.objective,
      status,
      targetSegment: body.targetSegment,
      startDate: body.startDate ?? null,
      endDate: body.endDate ?? null,
      budgetEstimate: typeof body.budgetEstimate === "number" ? body.budgetEstimate : null,
      notes: body.notes ?? null,
    });
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SOCIAL_CAMPAIGNS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SOCIAL_ERROR", message: "No se pudo guardar la campaña" }, { status: 500 });
  }
}
