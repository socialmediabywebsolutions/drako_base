export const dynamic = "force-dynamic";

/**
 * POST /api/socialflow/cron/prospector-followup
 * x-cron-secret: <CRON_SECRET>
 *
 * Cron diario que detecta prospectos sin respuesta y les envía follow-up automático.
 * Se ejecuta una vez al día desde Cloudflare Cron Triggers.
 *
 * Lógica:
 * - Busca prospectos con status EMAIL_SENT o WA_SENT
 * - Sin contacto en los últimos 3 días
 * - Con menos de 3 outreach enviados en total
 * - Les envía follow-up personalizado (email si tienen email)
 */

import { env } from "@/lib/cf";
import { getDb } from "@/lib/db";
import { listProspectsForFollowUp, recordOutreach } from "@/lib/socialflow/prospector/repository";
import { sendFollowUpEmail } from "@/lib/socialflow/prospector/email-outreach";
import { listCampaigns } from "@/lib/socialflow/prospector/repository";

function verifyCronSecret(request: Request): boolean {
  const bindings = env() as Record<string, unknown> | null;
  const cronSecret =
    (typeof bindings?.CRON_SECRET === "string" ? bindings.CRON_SECRET : null) ??
    (typeof process !== "undefined" ? process.env.CRON_SECRET : null);
  if (!cronSecret) return false;
  return request.headers.get("x-cron-secret") === cronSecret;
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }

  const db = getDb(request);
  const result = { tenantsProcessed: 0, followUpsSent: 0, errors: 0 };

  try {
    // Obtener todos los tenants activos via las campañas existentes
    // (reutilizamos el schema de campaigns para obtener tenant_ids únicos)
    const allCampaignsRaw = await db.prepare(
      `SELECT DISTINCT tenant_id FROM socialflow_campaigns WHERE status = 'ACTIVE' LIMIT 100`
    ).all<{ tenant_id: string }>().catch(() => ({ results: [] as { tenant_id: string }[] }));

    const tenantIds = (allCampaignsRaw.results ?? []).map((r) => r.tenant_id);

    for (const tenantId of tenantIds) {
      try {
        result.tenantsProcessed++;
        const prospects = await listProspectsForFollowUp(db, tenantId, 3);

        for (const prospect of prospects) {
          try {
            if (!prospect.email) continue; // solo email follow-up por ahora

            const emailResult = await sendFollowUpEmail({
              prospect,
              followUpNumber: prospect.outreachCount,
              senderName: "El equipo de Socialcors",
            });

            if (emailResult.ok) {
              await recordOutreach(db, prospect.id, tenantId, "EMAIL_SENT");
              result.followUpsSent++;
            }
          } catch (e) {
            result.errors++;
            console.error("[prospector-followup] Error on prospect", prospect.id, e);
          }
        }
      } catch (e) {
        result.errors++;
        console.error("[prospector-followup] Error on tenant", tenantId, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error("[prospector-followup] Fatal error", e);
    return new Response(JSON.stringify({ ok: false, error: "INTERNAL_ERROR" }), {
      status: 500, headers: { "content-type": "application/json" },
    });
  }
}
