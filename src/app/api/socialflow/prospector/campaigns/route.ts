import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getDb } from "@/lib/db";
import { createCampaign, listCampaigns } from "@/lib/socialflow/prospector/repository";
import { discoverProspects } from "@/lib/socialflow/prospector/discoverer";
import { bulkInsertProspects, incrementCampaignStat } from "@/lib/socialflow/prospector/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const db = getDb(request);
    const campaigns = await listCampaigns(db, session.tenantId);
    return new Response(JSON.stringify({ ok: true, campaigns }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_REQUIRED")
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
    console.error("[prospector/campaigns GET]", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json()) as { name?: string; niche?: string; location?: string; saasId?: string };

    const name = body.name?.trim();
    const niche = body.niche?.trim();
    const location = body.location?.trim();
    const saasId = body.saasId?.trim() || "socialflow";

    if (!name || !niche || !location) {
      return new Response(JSON.stringify({ error: "MISSING_FIELDS", required: ["name", "niche", "location"] }), {
        status: 400, headers: { "content-type": "application/json" },
      });
    }

    const db = getDb(request);

    // 1. Crear la campaña
    const campaign = await createCampaign(db, {
      tenantId: session.tenantId, saasId, name, niche, location,
    });

    // 2. Descubrir prospectos en background (no esperamos el resultado completo)
    // Lo lanzamos async para no bloquear la respuesta
    void (async () => {
      try {
        const rawProspects = await discoverProspects({
          niche, location,
          tenantId: session.tenantId, saasId, campaignId: campaign.id,
        });

        if (rawProspects.length > 0) {
          await bulkInsertProspects(db, rawProspects);
          // Actualizar contador de la campaña
          for (let i = 0; i < rawProspects.length; i++) {
            await incrementCampaignStat(db, campaign.id, "prospect_count");
          }
        }
      } catch (e) {
        console.error("[prospector] Discovery failed", e);
      }
    })();

    return new Response(JSON.stringify({ ok: true, campaign, discovering: true }), {
      status: 201, headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_REQUIRED")
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
    console.error("[prospector/campaigns POST]", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
