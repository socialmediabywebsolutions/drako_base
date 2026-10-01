import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getDb } from "@/lib/db";
import { updateProspectStatus, getProspect, incrementCampaignStat } from "@/lib/socialflow/prospector/repository";
import type { ProspectStatus } from "@/lib/socialflow/prospector/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json()) as { status?: string; notes?: string };

    const validStatuses: ProspectStatus[] = ["DISCOVERED", "EMAIL_SENT", "WA_SENT", "REPLIED", "DEMO_BOOKED", "CONVERTED", "LOST"];
    const status = body.status as ProspectStatus;
    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: "INVALID_STATUS", valid: validStatuses }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    const db = getDb(request);
    const prospect = await getProspect(db, params.id, session.tenantId);
    if (!prospect) {
      return new Response(JSON.stringify({ error: "PROSPECT_NOT_FOUND" }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }

    await updateProspectStatus(db, params.id, session.tenantId, status, body.notes);

    // Actualizar contadores de campaña en conversiones
    if (prospect.campaignId) {
      if (status === "REPLIED") await incrementCampaignStat(db, prospect.campaignId, "replied_count");
      if (status === "CONVERTED") await incrementCampaignStat(db, prospect.campaignId, "converted_count");
    }

    return new Response(JSON.stringify({ ok: true, status }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_REQUIRED")
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
    console.error("[prospector/status PATCH]", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
