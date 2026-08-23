import type { DracoEnv } from "@/lib/cf";
import { isAutoPublishBlockedByPrivatePilotMode } from "@/lib/socialflow/private-pilot";

// Nivel 3 — auto-aprobación con ventana de veto, SOLO para el tenant interno
// (775444ce). No toca SocialFlowOrchestrator.persistToDb(): los posts siguen
// naciendo en DRAFT exactamente igual que hoy. Preserva scheduled_at (no lo pisa a
// "ahora") — el margen de veto real es esta ventana de espera MÁS el tiempo hasta
// scheduled_at, que SchedulerAgent ya calculó al horario óptimo del nicho. Solo se
// reduce a lo que tarde el cron nativo de publicación (cada 1min, mismo worker) en
// recogerlo si ese scheduled_at ya venció para cuando este cron corre.
const TREND_TRIGGER_TENANT_ID = "775444ce-5ed0-4e69-864f-dc3e0d886817";
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

  // Mismo kill-switch que ya respeta processScheduledPosts() antes de publicar
  // (isAutoPublishBlockedByPrivatePilotMode) — si está bloqueado, no tiene sentido
  // mover DRAFT→SCHEDULED aquí para que se quede varado esperando ese mismo bloqueo
  // río abajo. No-op silencioso, nunca un error. El check de GENERATION_FAILED de
  // abajo también se salta a propósito: si el operador desactivó la IA a mano, un
  // TRIGGERED sin post todavía no es necesariamente un fallo real de generación.
  if (isAiGenerationDisabled()) {
    return { ok: true, candidates: 0, approved: 0, generationFailed: 0, skipped: "AI_DISABLED" };
  }
  if (isAutoPublishBlockedByPrivatePilotMode(env)) {
    return { ok: true, candidates: 0, approved: 0, generationFailed: 0, skipped: "PRIVATE_PILOT_AUTOPUBLISH_BLOCKED" };
  }

  try {
    const cutoff = new Date(Date.now() - VETO_WINDOW_MINUTES * 60 * 1000).toISOString();

    // scheduled_at IS NOT NULL: mismo requisito que ya exige processScheduledPosts()
    // para publicar — auto-aprobar un DRAFT sin scheduled_at solo lo dejaría varado
    // en SCHEDULED sin publicarse nunca, sin ganar nada.
    const { results: candidates } = await db
      .prepare(
        `SELECT id, campaign_id FROM saas_social_posts
         WHERE tenant_id = ? AND status = 'DRAFT' AND creation_mode = 'AUTO'
           AND scheduled_at IS NOT NULL AND datetime(created_at) <= datetime(?)`,
      )
      .bind(TREND_TRIGGER_TENANT_ID, cutoff)
      .all<{ id: string; campaign_id: string | null }>();

    let approved = 0;
    for (const candidate of candidates ?? []) {
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
    // de auto-aprobación.
    const { results: staleTriggers } = await db
      .prepare(
        `SELECT id, campaign_id FROM socialcors_trend_triggers
         WHERE tenant_id = ? AND status = 'TRIGGERED' AND datetime(created_at) <= datetime(?)`,
      )
      .bind(TREND_TRIGGER_TENANT_ID, cutoff)
      .all<{ id: string; campaign_id: string }>();

    let generationFailed = 0;
    for (const trigger of staleTriggers ?? []) {
      const hasPost = await db
        .prepare(`SELECT 1 as found FROM saas_social_posts WHERE tenant_id = ? AND campaign_id = ? LIMIT 1`)
        .bind(TREND_TRIGGER_TENANT_ID, trigger.campaign_id)
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
