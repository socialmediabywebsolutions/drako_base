import {
  SOCIALCORS_INTERNAL_CONTRACT_VERSION,
  type SocialFlowHealthCheck,
  type SocialFlowHealthChecks,
  type SocialFlowHealthStatus,
} from "@/lib/capabilities/internal-api-types/socialflow";
import type { DracoEnv } from "@/lib/cf";
import { resolvePublishSchedulerOwner } from "@/lib/socialflow/publish-scheduler-owner";

// Salud real de SocialCors para el contrato interno (P6): bindings, SOCIAL_DB y frescura del
// cron de publicación (cron_locks, ver P4). Sustituye a la respuesta fija "ok" anterior.

const PUBLISH_LOCK_BY_OWNER = { ai: "social-publish-ai", web: "social-publish", both: "social-publish-ai" } as const;
// El Worker IA reclama turno cada minuto y el web cada 5; margen para un par de turnos perdidos.
const MAX_PUBLISH_TURN_AGE_MINUTES = { ai: 10, web: 15, both: 10 } as const;
const REQUIRED_BINDINGS = ["SOCIALFLOW_AUTHS_DB", "SOCIAL_MEDIA_BUCKET", "SOCIALFLOW_AI_QUEUE"] as const;

function check(status: SocialFlowHealthStatus, detail: string): SocialFlowHealthCheck {
  return { status, detail };
}

export function aggregateHealthStatus(checks: SocialFlowHealthChecks): SocialFlowHealthStatus {
  const statuses = Object.values(checks).map((entry) => entry.status);
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

async function checkDatabase(db: D1Database | undefined): Promise<SocialFlowHealthCheck> {
  if (!db) return check("down", "SOCIAL_DB binding missing");
  try {
    await db.prepare("SELECT 1 AS ok").first();
    return check("ok", "SOCIAL_DB reachable");
  } catch (error) {
    return check("down", `SOCIAL_DB query failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkScheduler(env: DracoEnv | null, now: number): Promise<SocialFlowHealthCheck> {
  const db = env?.SOCIAL_DB;
  if (!db) return check("down", "SOCIAL_DB binding missing");
  const owner = resolvePublishSchedulerOwner(env);
  const lockKey = PUBLISH_LOCK_BY_OWNER[owner];
  try {
    const row = await db
      .prepare("SELECT MAX(turn) AS last_turn FROM cron_locks WHERE cron_route = ?")
      .bind(lockKey)
      .first<{ last_turn: string | null }>();
    const lastTurn = row?.last_turn ?? null;
    if (!lastTurn) return check("degraded", `No publish turn recorded for ${lockKey} (owner=${owner})`);
    const ageMinutes = Math.floor((now - Date.parse(lastTurn)) / 60_000);
    const detail = `Last ${lockKey} turn ${lastTurn} (${ageMinutes} min ago, owner=${owner})`;
    return check(ageMinutes > MAX_PUBLISH_TURN_AGE_MINUTES[owner] ? "degraded" : "ok", detail);
  } catch (error) {
    return check("degraded", `cron_locks unavailable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function buildSocialCorsHealthChecks(
  env: DracoEnv | null,
  now: number = Date.now(),
): Promise<SocialFlowHealthChecks> {
  const bindings = (env ?? {}) as Record<string, unknown>;
  const missing = REQUIRED_BINDINGS.filter((name) => !bindings[name]);

  const [database, scheduler] = await Promise.all([checkDatabase(env?.SOCIAL_DB), checkScheduler(env, now)]);

  return {
    contract: check("ok", `Internal contract ${SOCIALCORS_INTERNAL_CONTRACT_VERSION}`),
    runtime: missing.length === 0
      ? check("ok", "SocialCors runtime with all required bindings")
      : check("degraded", `Missing bindings: ${missing.join(", ")}`),
    auth: check("ok", "Service token and internal headers validated"),
    database,
    scheduler,
  };
}
