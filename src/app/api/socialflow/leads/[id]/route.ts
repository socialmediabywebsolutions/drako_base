import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getLeadById, resolveSocialContext, updateLeadStatus } from "@/lib/socialflow/leads/repository";
import type { LeadStatus } from "@/lib/socialflow/leads/types";

export const dynamic = "force-dynamic";

const VALID_STATUSES = new Set<LeadStatus>(["NEW", "CONTACTED", "CONVERTED", "LOST"]);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const { id } = await params;
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const lead = await getLeadById(ctx, id);
    if (!lead) {
      return new Response(JSON.stringify({ error: "LEAD_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, lead }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("SOCIALFLOW_LEAD_GET_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "LEAD_GET_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as {
      status?: string;
      saasId?: string;
    } | null;

    const saasId = body?.saasId?.trim() || "socialflow";
    const status = body?.status?.trim() as LeadStatus | undefined;

    if (!status || !VALID_STATUSES.has(status)) {
      return new Response(JSON.stringify({ error: "INVALID_STATUS" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const lead = await updateLeadStatus(ctx, id, status);
    if (!lead) {
      return new Response(JSON.stringify({ error: "LEAD_NOT_FOUND" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, lead }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("SOCIALFLOW_LEAD_PATCH_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "LEAD_UPDATE_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
