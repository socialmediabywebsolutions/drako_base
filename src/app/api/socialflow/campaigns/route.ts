export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  deleteSaasSocialCampaign,
  listSaasSocialCampaigns,
  resolveSocialContext,
  SocialContextError,
  upsertSaasSocialCampaign,
} from "@/lib/socialflow/repository";

// GENERATING y FAILED están reservados para el pipeline de IA (ver SocialFlowOrchestrator) — el usuario nunca los fija a mano.
const MANUAL_CAMPAIGN_STATUSES = ["ACTIVE", "PAUSED", "FINISHED", "ARCHIVED"] as const;

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const items = await listSaasSocialCampaigns(ctx);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_CAMPAIGNS_LIST_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to load campaigns" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      name?: string;
      objective?: string;
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
    const name = body.name?.trim() ?? "";
    if (!saasId || !name) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId and name are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });

    // Toda campaña creada a mano nace en DRAFT; el usuario la activa/pausa/finaliza/archiva después vía PATCH.
    const campaign = await upsertSaasSocialCampaign(ctx, {
      id: body.id,
      saasId,
      name,
      objective: body.objective ?? "AWARENESS",
      status: "DRAFT",
      targetSegment: body.targetSegment ?? "DEFAULT",
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
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_CAMPAIGNS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to save campaign" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      name?: string | null;
      status?: string | null;
      objective?: string | null;
      targetSegment?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      budgetEstimate?: number | null;
      notes?: string | null;
    } | null;
    if (!body?.id || !body.saasId) {
      return NextResponse.json({ code: "INVALID_BODY", message: "id and saasId are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: body.saasId });
    const current = (await listSaasSocialCampaigns(ctx)).find((campaign) => campaign.id === body.id);
    if (!current) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Campaign not found" }, { status: 404 });
    }

    const nextStatus = body.status ?? current.status;
    if (body.status && !MANUAL_CAMPAIGN_STATUSES.includes(nextStatus as (typeof MANUAL_CAMPAIGN_STATUSES)[number])) {
      return NextResponse.json(
        { code: "INVALID_STATUS", message: "status must be one of ACTIVE, PAUSED, FINISHED, ARCHIVED" },
        { status: 400 },
      );
    }

    const campaign = await upsertSaasSocialCampaign(ctx, {
      id: current.id,
      saasId: current.saasId,
      name: body.name ?? current.name,
      objective: body.objective ?? current.objective,
      status: nextStatus as typeof current.status,
      targetSegment: body.targetSegment ?? current.targetSegment,
      startDate: typeof body.startDate === "undefined" ? current.startDate : body.startDate,
      endDate: typeof body.endDate === "undefined" ? current.endDate : body.endDate,
      budgetEstimate: typeof body.budgetEstimate === "undefined" ? current.budgetEstimate : body.budgetEstimate,
      notes: typeof body.notes === "undefined" ? current.notes : body.notes,
    });
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_CAMPAIGNS_PATCH_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to update campaign" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const saasId = url.searchParams.get("saasId");

    if (!id || !saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id and saasId are required" }, { status: 400 });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });

    // Borra los posts en DRAFT de la campaña; los ya publicados/programados quedan huérfanos (campaign_id = NULL).
    await deleteSaasSocialCampaign(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ code: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ code: "UNAUTHORIZED", message: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_CAMPAIGNS_DELETE_ERROR", error);
    return NextResponse.json({ code: "SOCIALFLOW_ERROR", message: "Unable to delete campaign" }, { status: 500 });
  }
}
