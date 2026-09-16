import type { DracoEnv } from "@/lib/cf";
import { isTenantAllowedInPrivatePilot } from "@/lib/socialflow/private-pilot";

// Nivel 3 — auto-aprobación con ventana de veto. Generalizado el 16/09 para cubrir
// TODOS los tenants activos, no solo el piloto interno (775444ce) — mismo cambio que
// ya se hizo en TrendTriggerConnector.ts el 13/09: ese conector lleva 3 días
// generando TRIGGERED reales para cualquier tenant (ver el de Sofía Marén,
// ea85eb95, atascado 76h porque este cron seguía filtrando solo por el tenant
// interno). No toca SocialFlowOrchestrator.persistToDb(): los posts siguen naciendo
// en DRAFT exactamente igual que hoy. Preserva scheduled_at (no lo pisa a "ahora") —
// el margen de veto real es esta ventana de espera MÁS el tiempo hasta scheduled_at,
// que SchedulerAgent ya calculó al horario óptimo del nicho. Solo se reduce a lo que
// tarde el cron nativo de publicación (cada 1min, mismo worker) en recogerlo si ese
// scheduled_at ya venció para cuando este cron corre.
const VETO_WINDOW_MINUTES = 45;

// Mismo patrón que TrendTriggerConnector.ts: SOCIALFLOW_DISABLE_AI solo se expone vía
// process.env (Vars de wrangler), no está declarado en DracoEnv.
function isAiGenerationDisabled(): boolean {
  const raw = typeof process !== "undefined" ? process.env.SOCIALFLOW_DISABLE_AI : undefined;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export type TrendAutoApproveResult = {
  ok: boolean;
  candidates: number;
  approved: number;
  generationFailed: number;
  skipped?: string;
  error?: string;
};

export async function runTrendAutoApproveCron(env: DracoEnv): Promise<TrendAutoApproveResult> {
  const db = env?.SOCIAL_DB;
  if (!db) return { ok: true, candidates: 0, approved: 0, generationFailed: 0 };

  // Kill-switch global — si el operador desactivó la IA a mano, un TRIGGERED sin post
  // todavía no es necesariamente un fallo real de generación, así que también se salta
  // la reconciliación GENERATION_FAILED de abajo (no solo la auto-aprobación). No-op
  // silencioso, nunca un error.
  if (isAiGenerationDisabled()) {
    return { ok: true, candidates: 0, approved: 0, generationFailed: 0, skipped: "AI_DISABLED" };
  }

  try {
    const cutoff = new Date(Date.now() - VETO_WINDOW_MINUTES * 60 * 1000).toISOString();

    // Ya NO se filtra por tenant_id — TrendTriggerConnector.ts genera TRIGGERED para
    // cualquier tenant activo desde el 13/09, así que este cron debe poder resolverlos
    // a todos, no solo al piloto interno. scheduled_at IS NOT NULL: mismo requisito que
    // ya exige processScheduledPosts() para publicar — auto-aprobar un DRAFT sin
    // scheduled_at solo lo dejaría varado en SCHEDULED sin publicarse nunca.
    const { results: candidates } = await db
      .prepare(
        `SELECT id, tenant_id, campaign_id FROM saas_social_posts
         WHERE status = 'DRAFT' AND creation_mode = 'AUTO'
           AND scheduled_at IS NOT NULL AND datetime(created_at) <= datetime(?)`,
      )
      .bind(cutoff)
      .all<{ id: string; tenant_id: string; campaign_id: string | null }>();

    let approved = 0;
    for (const candidate of candidates ?? []) {
      // AUTO-PUBLICACIÓN: aquí (no en la reconciliación de abajo) es donde este cron
      // realmente "publica" — pasar un post a SCHEDULED lo entrega al cron nativo de
      // publicación. Mismo criterio que el queue.send() de TrendTriggerConnector.ts:
      // isTenantAllowedInPrivatePilot gatea solo esta acción, nunca el marcado de
      // estados (la reconciliación GENERATION_FAILED de abajo corre para todos).
      if (!isTenantAllowedInPrivatePilot(candidate.tenant_id, env)) continue;

      const now = new Date().toISOString();
      // Escritura condicional por status = 'DRAFT': si un humano rechazó justo antes,
      // esta fila ya no matchea y el UPDATE simplemente no la toca — gana el veto,
      // sin lógica especial para la carrera.
      const updateResult = await db
        .prepare(`UPDATE saas_social_posts SET status = 'SCHEDULED', updated_at = ? WHERE id = ? AND status = 'DRAFT'`)
        .bind(now, candidate.id)
        .run();
      const changed = ((updateResult?.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
      if (!changed) continue;
      approved++;

      if (candidate.campaign_id) {
        // Best-effort: creation_mode = 'AUTO' también cubre "Generar campaña" manual
        // desde el botón de la UI, no solo lo que dispara TrendTriggerConnector — si
        // no hay fila de trigger para este campaign_id, no hay nada que marcar, y un
        // fallo aquí nunca debe deshacer la aprobación del post ya confirmada arriba.
        await db
          .prepare(
            `UPDATE socialcors_trend_triggers SET status = 'AUTO_APPROVED', resolved_at = ?
             WHERE campaign_id = ? AND status = 'TRIGGERED'`,
          )
          .bind(now, candidate.campaign_id)
          .run()
          .catch(() => {});
      }
    }

    // Cierre del gap GENERATION_FAILED: un TRIGGERED sin ningún post asociado tras la
    // misma ventana de 45min ya no es "en curso" — cubre tanto generatePostImage()
    // fallando dentro de persistToDb() (que atrapa el error por post y sigue sin
    // avisar a nadie) como el caso límite de TrendTriggerConnector donde el INSERT del
    // trigger tuvo éxito pero el queue.send() posterior falló y la campaña nunca se
    // encoló. Reusa el mismo `cutoff` — un post que sí aterrizó pero sigue en DRAFT
    // dentro de la ventana ya lo cubre el loop de arriba en esta misma corrida o en la
    // siguiente, así que "TRIGGERED viejo" es un fallo real, no una carrera con el loop
    // de auto-aprobación. Sin filtro de tenant_id (todos) NI de isTenantAllowedInPrivatePilot
    // — es puro marcado de estados, nunca causa una publicación, así que nunca se gatea.
    const { results: staleTriggers } = await db
      .prepare(
        `SELECT id, tenant_id, campaign_id FROM socialcors_trend_triggers
         WHERE status = 'TRIGGERED' AND datetime(created_at) <= datetime(?)`,
      )
      .bind(cutoff)
      .all<{ id: string; tenant_id: string; campaign_id: string }>();

    let generationFailed = 0;
    for (const trigger of staleTriggers ?? []) {
      const hasPost = await db
        .prepare(`SELECT 1 as found FROM saas_social_posts WHERE tenant_id = ? AND campaign_id = ? LIMIT 1`)
        .bind(trigger.tenant_id, trigger.campaign_id)
        .first<{ found: number }>();
      if (hasPost) continue; // aterrizó pero sigue DRAFT dentro de ventana — no es un fallo

      await db
        .prepare(
          `UPDATE socialcors_trend_triggers SET status = 'GENERATION_FAILED', resolved_at = ?
           WHERE id = ? AND status = 'TRIGGERED'`,
        )
        .bind(new Date().toISOString(), trigger.id)
        .run();
      generationFailed++;
    }

    return { ok: true, candidates: candidates?.length ?? 0, approved, generationFailed };
  } catch (err) {
    return { ok: false, candidates: 0, approved: 0, generationFailed: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
