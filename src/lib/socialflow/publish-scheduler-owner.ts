import { env as resolveEnv, type DracoEnv } from "@/lib/cf";

/**
 * Quién publica los posts programados (P4 del plan de independencia).
 *
 * - "ai":   el Worker IA (cron cada minuto) es el responsable. El Worker web solo actúa
 *           como red de seguridad: recoge posts con más de WEB_FALLBACK_MIN_OVERDUE_MINUTES
 *           de retraso, es decir, cuando el Worker IA no está publicando.
 * - "web":  solo el Worker web (*\/5) publica; el Worker IA no toca la publicación.
 * - "both": comportamiento anterior: los dos publican todo lo vencido. Es el valor por
 *           defecto si la var no está definida.
 *
 * En cualquier modo, el claim por fila (SCHEDULED → PUBLISHING) impide que un mismo post
 * se publique dos veces en paralelo.
 */
export type PublishSchedulerOwner = "ai" | "web" | "both";

export const WEB_FALLBACK_MIN_OVERDUE_MINUTES = 10;

export function resolvePublishSchedulerOwner(envOverride?: DracoEnv | null): PublishSchedulerOwner {
  const runtimeEnv = envOverride ?? resolveEnv();
  const raw = (runtimeEnv?.SOCIALFLOW_PUBLISH_SCHEDULER_OWNER ?? "").trim().toLowerCase();
  if (raw === "ai" || raw === "web" || raw === "both") return raw;
  return "both";
}
