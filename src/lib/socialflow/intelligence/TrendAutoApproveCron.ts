import type { DracoEnv } from "@/lib/cf";
import { isTenantAllowedInPrivatePilot } from "@/lib/socialflow/private-pilot";

// Nivel 3 — auto-aprobación con ventana de veto. Generalizado el 16/09 para cubrir
// TODOS los tenants activos, no solo el piloto interno (775444ce) — mismo cambio que
// ya se hizo en TrendTriggerConnector.ts el 13/09: ese conector lleva días generando
// TRIGGERED reales para cualquier tenant. No toca SocialFlowOrchestrator.persistToDb():
// los posts siguen naciendo en DRAFT exactamente igual que hoy. Preserva scheduled_at
// (no lo pisa a "ahora") — el margen de veto real es esta ventana de espera MÁS el
// tiempo hasta scheduled_at, que SchedulerAgent ya calculó al horario óptimo del
// nicho. Solo se reduce a lo que tarde el cron nativo de publicación (cada 1min,
// mismo worker) en recogerlo si ese scheduled_at ya venció para cuando este cron corre.
//
// Incidente 16/09: la generalización de arriba, sin más gates, auto-aprobó de golpe
// un backlog de DRAFTs viejos de varias semanas (scheduled_at muy en el pasado) y 3 de
// ellos se publicaron de verdad en Instagram con contenido obsoleto/fuera de nicho sin
// que nadie los revisara. SCHEDULED_AT_EXPIRY_HOURS y DRAFT_EXPIRY_DAYS abajo son la
// respuesta directa a eso: un DRAFT no se auto-aprueba solo por existir y tener
// scheduled_at no-nulo, también tiene que seguir siendo una fecha razonablemente
// reciente.
const VETO_WINDOW_MINUTES = 45;

// Un candidato con scheduled_at más viejo que esto nunca se auto-aprueba — publicarlo
// ahora sería publicar contenido pensado para una fecha ya muy pasada, sin que nadie
// lo haya revisado. Se marca el trigger asociado (si lo hay) como GENERATION_FAILED
// con resolution_reason SCHEDULED_AT_EXPIRED en vez de intentar publicarlo.
const SCHEDULED_AT_EXPIRY_HOURS = 48;

// Un DRAFT de creation_mode='AUTO' que lleva más de esto sin que nadie lo apruebe (y
// sin un scheduled_at futuro válido que lo rescate) ya no es "pendiente de revisión",
// es contenido abandonado — se marca EXPIRED directamente, sin pasar por el intento de
// auto-publicación de abajo.
const DRAFT_EXPIRY_DAYS = 7;

// Mismo patrón que TrendTriggerConnector.ts: SOCIALFLOW_DISABLE_AI solo se expone vía
// process.env (Vars de wrangler), no está declarado en DracoEnv.
function isAiGenerationDisabled(): boolean {
  const raw = typeof process !== "undefined" ? process.env.SOCIALFLOW_DISABLE_AI : undefined;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

// resolution_reason no existe en la migración original (0222) de socialcors_trend_triggers
// — mismo patrón defensivo de PRAGMA table_info + ALTER TABLE que ya usa
// leads/repository.ts para last_contact_at, para no romper filas ya existentes en
// producción ni requerir una migración separada antes de desplegar esto.
async function ensureTriggerResolutionReasonColumn(db: D1Database): Promise<void> {
  const { results } = await db.prepare(`PRAGMA table_info('socialcors_trend_triggers')`).all<{ name: string }>();
  const existing = new Set((results ?? []).map((column) => column.name));
  if (!existing.has("resolution_reason")) {
    await db.prepare(`ALTER TABLE socialcors_trend_triggers ADD COLUMN resolution_reason TEXT`).run();
  }
}

export type TrendAutoApproveResult = {
  ok: boolean;
  candidates: number;
  approved: number;
  generationFailed: number;
  expired: number;
  skipped?: string;
  error?: string;
};

export async function runTrendAutoApproveCron(env: DracoEnv): Promise<TrendAutoApproveResult> {
  const db = env?.SOCIAL_DB;
  if (!db) return { ok: true, candidates: 0, approved: 0, generationFailed: 0, expired: 0 };

  // Kill-switch global — si el operador desactivó la IA a mano, un TRIGGERED sin post
  // todavía no es necesariamente un fallo real de generación, así que también se salta
  // la reconciliación GENERATION_FAILED de abajo (no solo la auto-aprobación). No-op
  // silencioso, nunca un error.
  if (isAiGenerationDisabled()) {
    return { ok: true, candidates: 0, approved: 0, generationFailed: 0, expired: 0, skipped: "AI_DISABLED" };
  }

  try {
    await ensureTriggerResolutionReasonColumn(db);

    const cutoff = new Date(Date.now() - VETO_WINDOW_MINUTES * 60 * 1000).toISOString();
    const scheduledAtExpiryCutoff = new Date(Date.now() - SCHEDULED_AT_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();
    const draftExpiryCutoff = new Date(Date.now() - DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // FASE 0 — barrido de DRAFT abandonados: AUTO, más de 7 días desde created_at, y
    // sin un scheduled_at futuro válido que todavía lo justifique. Se resuelven a
    // EXPIRED directamente, sin pasar por el intento de auto-publicación de la fase 1
    // — nunca gatea por private pilot, es puro marcado de estado terminal, no una
    // publicación. Corre antes de la fase 1 para que estos posts ni siquiera entren en
    // la query de candidatos de abajo (ya no estarán en status='DRAFT').
    const { results: abandonedDrafts } = await db
      .prepare(
        `SELECT id FROM saas_social_posts
         WHERE status = 'DRAFT' AND creation_mode = 'AUTO'
           AND datetime(created_at) <= datetime(?)
           AND (scheduled_at IS NULL OR datetime(scheduled_at) <= datetime(?))`,
      )
      .bind(draftExpiryCutoff, now)
      .all<{ id: string }>();

    let expired = 0;
    for (const draft of abandonedDrafts ?? []) {
      const updateResult = await db
        .prepare(`UPDATE saas_social_posts SET status = 'EXPIRED', updated_at = ? WHERE id = ? AND status = 'DRAFT'`)
        .bind(new Date().toISOString(), draft.id)
        .run();
      const changed = ((updateResult?.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
      if (changed) expired++;
    }

    // FASE 1 — candidatos a auto-aprobación. Ya NO se filtra por tenant_id —
    // TrendTriggerConnector.ts genera TRIGGERED para cualquier tenant activo desde el
    // 13/09, así que este cron debe poder resolverlos a todos, no solo al piloto
    // interno. scheduled_at IS NOT NULL: mismo requisito que ya exige
    // processScheduledPosts() para publicar — auto-aprobar un DRAFT sin scheduled_at
    // solo lo dejaría varado en SCHEDULED sin publicarse nunca.
    const { results: candidates } = await db
      .prepare(
        `SELECT id, tenant_id, campaign_id, scheduled_at FROM saas_social_posts
         WHERE status = 'DRAFT' AND creation_mode = 'AUTO'
           AND scheduled_at IS NOT NULL AND datetime(created_at) <= datetime(?)`,
      )
      .bind(cutoff)
      .all<{ id: string; tenant_id: string; campaign_id: string | null; scheduled_at: string }>();

    let approved = 0;
    let generationFailed = 0;
    for (const candidate of candidates ?? []) {
      // Gate de seguridad (incidente 16/09): un scheduled_at más viejo que
      // SCHEDULED_AT_EXPIRY_HOURS nunca se auto-aprueba — publicarlo ahora sería
      // publicar contenido pensado para una fecha ya muy pasada, sin revisión humana.
      // Se marca el trigger asociado como GENERATION_FAILED (si existe uno TRIGGERED
      // para este campaign_id) con resolution_reason SCHEDULED_AT_EXPIRED, y se pasa
      // al siguiente candidato sin tocar el post — sigue en DRAFT hasta que un humano
      // lo revise o, pasados 7 días, lo recoja la fase 0 como EXPIRED.
      if (candidate.scheduled_at < scheduledAtExpiryCutoff) {
        if (candidate.campaign_id) {
          const updateResult = await db
            .prepare(
              `UPDATE socialcors_trend_triggers SET status = 'GENERATION_FAILED', resolved_at = ?, resolution_reason = ?
               WHERE campaign_id = ? AND status = 'TRIGGERED'`,
            )
            .bind(new Date().toISOString(), "SCHEDULED_AT_EXPIRED", candidate.campaign_id)
            .run()
            .catch(() => null);
          const changed = ((updateResult?.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
          if (changed) generationFailed++;
        }
        continue;
      }

      // AUTO-PUBLICACIÓN: aquí (no en la reconciliación de abajo) es donde este cron
      // realmente "publica" — pasar un post a SCHEDULED lo entrega al cron nativo de
      // publicación. Mismo criterio que el queue.send() de TrendTriggerConnector.ts:
      // isTenantAllowedInPrivatePilot gatea solo esta acción, nunca el marcado de
      // estados (la reconciliación GENERATION_FAILED de abajo corre para todos).
      if (!isTenantAllowedInPrivatePilot(candidate.tenant_id, env)) continue;

      const approvedAt = new Date().toISOString();
      // Escritura condicional por status = 'DRAFT': si un humano rechazó justo antes,
      // esta fila ya no matchea y el UPDATE simplemente no la toca — gana el veto,
      // sin lógica especial para la carrera.
      const updateResult = await db
        .prepare(`UPDATE saas_social_posts SET status = 'SCHEDULED', updated_at = ? WHERE id = ? AND status = 'DRAFT'`)
        .bind(approvedAt, candidate.id)
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
          .bind(approvedAt, candidate.campaign_id)
          .run()
          .catch(() => {});
      }
    }

    // FASE 2 — cierre del gap GENERATION_FAILED: un TRIGGERED sin ningún post asociado
    // tras la misma ventana de 45min ya no es "en curso" — cubre tanto
    // generatePostImage() fallando dentro de persistToDb() (que atrapa el error por
    // post y sigue sin avisar a nadie) como el caso límite de TrendTriggerConnector
    // donde el INSERT del trigger tuvo éxito pero el queue.send() posterior falló y la
    // campaña nunca se encoló. Reusa el mismo `cutoff` — un post que sí aterrizó pero
    // sigue en DRAFT dentro de la ventana ya lo cubre el loop de la fase 1 en esta
    // misma corrida o en la siguiente, así que "TRIGGERED viejo" es un fallo real, no
    // una carrera con el loop de auto-aprobación. Sin filtro de tenant_id (todos) NI
    // de isTenantAllowedInPrivatePilot — es puro marcado de estados, nunca causa una
    // publicación, así que nunca se gatea.
    const { results: staleTriggers } = await db
      .prepare(
        `SELECT id, tenant_id, campaign_id FROM socialcors_trend_triggers
         WHERE status = 'TRIGGERED' AND datetime(created_at) <= datetime(?)`,
      )
      .bind(cutoff)
      .all<{ id: string; tenant_id: string; campaign_id: string }>();

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

    return { ok: true, candidates: candidates?.length ?? 0, approved, generationFailed, expired };
  } catch (err) {
    return { ok: false, candidates: 0, approved: 0, generationFailed: 0, expired: 0, error: err instanceof Error ? err.message : String(err) };
  }
}
