import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getDb } from "@/lib/db";
import { getProspect, recordOutreach, incrementCampaignStat } from "@/lib/socialflow/prospector/repository";
import { sendProspectEmail } from "@/lib/socialflow/prospector/email-outreach";
import { sendProspectWhatsApp, buildWhatsAppLink } from "@/lib/socialflow/prospector/whatsapp-outreach";

export const dynamic = "force-dynamic";

/**
 * POST /api/socialflow/prospector/:id/outreach
 *
 * Envía un contacto de prospección al prospecto (email y/o WhatsApp).
 * Body: { channel: "EMAIL" | "WHATSAPP" | "BOTH", senderName: string, brandName?: string }
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json()) as {
      channel?: "EMAIL" | "WHATSAPP" | "BOTH";
      senderName?: string;
      brandName?: string;
    };

    const channel = body.channel ?? "EMAIL";
    const senderName = body.senderName?.trim() || "El equipo de Socialcors";
    const brandName = body.brandName?.trim() || "Socialcors";

    const db = getDb(request);
    const prospect = await getProspect(db, params.id, session.tenantId);

    if (!prospect) {
      return new Response(JSON.stringify({ error: "PROSPECT_NOT_FOUND" }), {
        status: 404, headers: { "content-type": "application/json" },
      });
    }

    const results: Record<string, unknown> = {};
    let anySuccess = false;

    // ── Email outreach ──────────────────────────────────────────────────────
    if (channel === "EMAIL" || channel === "BOTH") {
      if (!prospect.email) {
        results.email = { ok: false, code: "NO_EMAIL" };
      } else {
        const emailResult = await sendProspectEmail({ prospect, senderName, brandName });
        results.email = emailResult;
        if (emailResult.ok) anySuccess = true;
      }
    }

    // ── WhatsApp outreach ───────────────────────────────────────────────────
    if (channel === "WHATSAPP" || channel === "BOTH") {
      const waResult = await sendProspectWhatsApp({ prospect, senderName });
      results.whatsapp = waResult;
      if (waResult.ok) anySuccess = true;
      // Incluir el link wa.me siempre que haya teléfono (para envío manual)
      if (!waResult.waLink && (prospect.whatsapp || prospect.phone)) {
        const link = await buildWhatsAppLink(prospect, senderName);
        if (link) results.waLink = link;
      } else if (waResult.waLink) {
        results.waLink = waResult.waLink;
      }
    }

    // ── Actualizar estado en DB ─────────────────────────────────────────────
    if (anySuccess) {
      const newStatus = channel === "WHATSAPP" ? "WA_SENT" : "EMAIL_SENT";
      await recordOutreach(db, prospect.id, session.tenantId, newStatus);
      if (prospect.campaignId) {
        await incrementCampaignStat(db, prospect.campaignId, "email_sent_count");
      }
    }

    return new Response(JSON.stringify({ ok: anySuccess, results }), {
      status: anySuccess ? 200 : 422,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SESSION_REQUIRED")
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), { status: 401, headers: { "content-type": "application/json" } });
    console.error("[prospector/outreach POST]", e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
