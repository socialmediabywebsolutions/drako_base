import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { listLeads, resolveSocialContext } from "@/lib/socialflow/leads/repository";
import type { LeadStatus, LeadTemperature } from "@/lib/socialflow/leads/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";
    const temperature = (url.searchParams.get("temperature")?.trim() || null) as LeadTemperature | null;
    const status = (url.searchParams.get("status")?.trim() || null) as LeadStatus | null;
    const limitRaw = url.searchParams.get("limit");
    const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 100, 1), 500) : 100;

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const leads = await listLeads(ctx, { temperature, status, limit });

    return new Response(JSON.stringify({ ok: true, leads }), {
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
    console.error("SOCIALFLOW_LEADS_LIST_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "LEADS_LIST_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
