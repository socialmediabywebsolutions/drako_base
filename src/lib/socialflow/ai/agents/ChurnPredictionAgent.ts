import { listSaasSocialPosts, resolveSocialContext } from "@/lib/socialflow/repository";
import { env, type DracoEnv } from "@/lib/cf";

const NO_ACTIVITY_SENTINEL_DAYS = 9999;
const LAST_POST_THRESHOLD_DAYS = 14;
const LAST_LOGIN_THRESHOLD_DAYS = 7;
const REJECTION_RATIO_THRESHOLD = 0.5;
const ABANDONED_DRAFT_THRESHOLD_DAYS = 7;
const REJECTION_WINDOW_DAYS = 30;

const LAST_POST_POINTS = 40;
const LAST_LOGIN_POINTS = 30;
const REJECTION_POINTS = 20;
const ABANDONED_DRAFT_POINTS = 10;

export type ChurnPredictionResult = {
  churnRiskScore: number;
  riskFactors: string[];
  daysSinceLastPost: number;
  daysSinceLastLogin: number;
};

function daysSince(iso: string | null | undefined): number {
  if (!iso) return NO_ACTIVITY_SENTINEL_DAYS;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return NO_ACTIVITY_SENTINEL_DAYS;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// MAX(issued_at) en SOCIALFLOW_AUTHS_DB.socialflow_sessions es el proxy real de "último
// login" — socialflow_users no tiene last_login_at/last_seen_at (no existen esas
// columnas). Lectura read-only y acotada a esta única consulta, mismo criterio que
// billing/enforce.ts al cruzar a esta base cuando hace falta un dato que solo vive ahí.
async function getLastLoginIso(tenantId: string, dracoEnv: DracoEnv): Promise<string | null> {
  const authsDb = dracoEnv?.SOCIALFLOW_AUTHS_DB;
  if (!authsDb) return null;

  try {
    const row = await authsDb
      .prepare(`SELECT MAX(issued_at) as last_login FROM socialflow_sessions WHERE tenant_id = ?`)
      .bind(tenantId)
      .first<{ last_login: string | null }>();
    return row?.last_login ?? null;
  } catch (err) {
    console.error("[ChurnPredictionAgent] getLastLoginIso failed", tenantId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Detecta señales de inactividad/abandono por tenant (sin publicar, sin login, alto
// rechazo de posts, drafts abandonados) y calcula un churn risk score puramente
// aritmético (sin llamadas a Mistral). Nunca escribe en socialflow_intelligence_feed —
// esta señal es visible SOLO para el equipo de Drako (vía getLatestChurnPrediction y el
// endpoint /api/operator/socialflow/churn-risk), nunca para el cliente. Persiste en
// socialcors_churn_predictions (tabla propia por tenant, migración 0237).
export class ChurnPredictionAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<ChurnPredictionResult | null> {
    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) return null;

    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const allPosts = await listSaasSocialPosts(ctx);

    const published = allPosts
      .filter((p) => p.status === "POSTED" || p.status === "PUBLISHED")
      .sort((a, b) => new Date(b.postedAt ?? b.createdAt).getTime() - new Date(a.postedAt ?? a.createdAt).getTime());
    const daysSinceLastPost = daysSince(published[0]?.postedAt ?? published[0]?.createdAt ?? null);

    const lastLoginIso = await getLastLoginIso(input.tenantId, dracoEnv);
    const daysSinceLastLogin = daysSince(lastLoginIso);

    const rejectionWindowMs = Date.now() - REJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const reviewedRecent = allPosts.filter(
      (p) => (p.status === "APPROVED" || p.status === "REJECTED") && new Date(p.updatedAt).getTime() >= rejectionWindowMs,
    );
    const rejectedRecent = reviewedRecent.filter((p) => p.status === "REJECTED");
    // Sin actividad de aprobación/rechazo en la ventana, el ratio no está definido — no
    // se asume "muchos rechazos" cuando en realidad no hay datos.
    const rejectionRatio = reviewedRecent.length > 0 ? rejectedRecent.length / reviewedRecent.length : null;

    const draftAgeThresholdMs = Date.now() - ABANDONED_DRAFT_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    const abandonedDrafts = allPosts.filter((p) => p.status === "DRAFT" && new Date(p.createdAt).getTime() < draftAgeThresholdMs);

    let churnRiskScore = 0;
    const riskFactors: string[] = [];

    if (daysSinceLastPost > LAST_POST_THRESHOLD_DAYS) {
      churnRiskScore += LAST_POST_POINTS;
      riskFactors.push(`Sin publicar hace ${daysSinceLastPost} días`);
    }
    if (daysSinceLastLogin > LAST_LOGIN_THRESHOLD_DAYS) {
      churnRiskScore += LAST_LOGIN_POINTS;
      riskFactors.push(`Sin iniciar sesión hace ${daysSinceLastLogin} días`);
    }
    if (rejectionRatio !== null && rejectionRatio > REJECTION_RATIO_THRESHOLD) {
      churnRiskScore += REJECTION_POINTS;
      riskFactors.push(`${Math.round(rejectionRatio * 100)}% de sus posts revisados en los últimos ${REJECTION_WINDOW_DAYS} días fueron rechazados`);
    }
    if (abandonedDrafts.length > 0) {
      churnRiskScore += ABANDONED_DRAFT_POINTS;
      riskFactors.push(`${abandonedDrafts.length} borrador(es) sin aprobar hace más de ${ABANDONED_DRAFT_THRESHOLD_DAYS} días`);
    }

    const result: ChurnPredictionResult = { churnRiskScore, riskFactors, daysSinceLastPost, daysSinceLastLogin };

    await upsertChurnPrediction(input.tenantId, input.saasId, JSON.stringify(result), dracoEnv);
    return result;
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0237) -------------------

async function upsertChurnPrediction(tenantId: string, saasId: string, snapshot: string, dracoEnv: DracoEnv): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_churn_predictions WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_churn_predictions SET snapshot_json = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_churn_predictions (id, tenant_id, saas_id, snapshot_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, now, now)
      .run();
  } catch (err) {
    console.error("[ChurnPredictionAgent] upsertChurnPrediction failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el endpoint de operador — nunca vuelve a leer posts/sesiones,
// solo el snapshot que ya calculó el cron diario.
export async function getLatestChurnPrediction(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<ChurnPredictionResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_churn_predictions WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as ChurnPredictionResult;
  } catch (err) {
    console.error("[ChurnPredictionAgent] getLatestChurnPrediction failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type ChurnPredictionTenantRow = { tenantId: string; saasId: string; result: ChurnPredictionResult };

// Todos los tenants con churnRiskScore por encima del umbral — usado por el endpoint de
// operador (/api/operator/socialflow/churn-risk). Lee todas las filas de la tabla y
// filtra en memoria (volumen bajo: una fila por tenant, no por evento).
export async function listHighChurnRiskTenants(dracoEnv: DracoEnv, minScore = 60): Promise<ChurnPredictionTenantRow[]> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(`SELECT tenant_id, saas_id, snapshot_json FROM socialcors_churn_predictions`)
      .all<{ tenant_id: string; saas_id: string; snapshot_json: string }>();

    return (results ?? [])
      .flatMap((row) => {
        try {
          const result = JSON.parse(row.snapshot_json) as ChurnPredictionResult;
          return result.churnRiskScore > minScore ? [{ tenantId: row.tenant_id, saasId: row.saas_id, result }] : [];
        } catch {
          return [];
        }
      })
      .sort((a, b) => b.result.churnRiskScore - a.result.churnRiskScore);
  } catch (err) {
    console.error("[ChurnPredictionAgent] listHighChurnRiskTenants failed", err instanceof Error ? err.message : String(err));
    return [];
  }
}

export type ChurnPredictionTenantOutcome = { tenantId: string; saasId: string; ok: boolean; churnRiskScore?: number; error?: string };

// Corre diariamente para todo tenant onboardeado — sin gate de posts publicados (a
// diferencia del cron de style-learning): justo los tenants con pocos o ningún post
// publicado son los que más importa vigilar para detección de abandono. Mismo patrón de
// enumeración que runViralOpportunityCron/runSeasonalOpportunityCron: nunca lanza por
// un tenant fallido, sigue con el resto.
export async function runChurnPredictionCron(cronEnv: DracoEnv): Promise<ChurnPredictionTenantOutcome[]> {
  const db = cronEnv?.SOCIAL_DB;
  if (!db) return [];

  const { results: tenantRows } = await db.prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`).all<{
    tenant_id: string;
    saas_id: string;
  }>();

  const results: ChurnPredictionTenantOutcome[] = [];
  for (const row of tenantRows ?? []) {
    try {
      const outcome = await new ChurnPredictionAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id });
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: true, churnRiskScore: outcome?.churnRiskScore ?? 0 });
    } catch (err) {
      console.error("[ChurnPredictionAgent] tenant failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
