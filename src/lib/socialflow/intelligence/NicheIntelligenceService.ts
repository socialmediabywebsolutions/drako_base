import type { DracoEnv } from "@/lib/cf";

export type Env = DracoEnv;

export type NicheIntelligence = {
  niche: string;
  analysis: Record<string, unknown> | null;
  hashtags: string[];
  formats: string[];
  hooks: string[];
  optimalHours: number[];
  fatigueSignals: string[];
  updatedAt: string;
  validUntil: string;
};

export type StyleSnapshot = {
  id: string;
  tenantId: string;
  saasId: string;
  snapshotJson: string;
  postCount: number;
  createdAt: string;
};

export type FatigueWarning = {
  dominantPattern: string;
  occurrences: number;
  description: string;
};

const MAX_STYLE_SNAPSHOTS_PER_TENANT = 12;
const STYLE_HISTORY_LOOKBACK = 6;
const FATIGUE_WINDOW = 3;

type NicheIntelligenceRow = {
  niche: string;
  analysis_json: string;
  hashtags_json: string;
  formats_json: string;
  hooks_json: string;
  optimal_hours_json: string;
  fatigue_signals_json: string;
  updated_at: string;
  valid_until: string;
};

type StyleHistoryRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  snapshot_json: string;
  post_count: number;
  created_at: string;
};

function safeParseArray<T>(json: string | null | undefined): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function safeParseObject(json: string | null | undefined): Record<string, unknown> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mapStyleHistoryRow(row: StyleHistoryRow): StyleSnapshot {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    snapshotJson: row.snapshot_json,
    postCount: row.post_count,
    createdAt: row.created_at,
  };
}

// Cross-tenant, aggregated cache of "what's working this week" per niche — not
// scoped to a single tenant on purpose (see migration 0207). Returns null on any
// miss (not yet cached, expired, or DB error) so callers can degrade gracefully
// instead of blocking content generation: this cache is filled by a separate cron
// job, not by the generation path itself.
export async function getNicheIntelligence(niche: string, env: Env): Promise<NicheIntelligence | null> {
  const db = env?.SOCIAL_DB;
  if (!db || !niche) return null;

  try {
    const now = new Date().toISOString();
    const row = await db
      .prepare(
        `SELECT niche, analysis_json, hashtags_json, formats_json, hooks_json,
                optimal_hours_json, fatigue_signals_json, updated_at, valid_until
         FROM socialcors_niche_intelligence
         WHERE niche = ? AND valid_until > ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .bind(niche, now)
      .first<NicheIntelligenceRow>();

    if (!row) return null;

    return {
      niche: row.niche,
      analysis: safeParseObject(row.analysis_json),
      hashtags: safeParseArray<string>(row.hashtags_json),
      formats: safeParseArray<string>(row.formats_json),
      hooks: safeParseArray<string>(row.hooks_json),
      optimalHours: safeParseArray<number>(row.optimal_hours_json),
      fatigueSignals: safeParseArray<string>(row.fatigue_signals_json),
      updatedAt: row.updated_at,
      validUntil: row.valid_until,
    };
  } catch (err) {
    console.error("[NicheIntelligenceService] getNicheIntelligence failed", niche, err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Most recent style-learning snapshots for a tenant, newest first.
export async function getStyleHistory(tenantId: string, saasId: string, env: Env): Promise<StyleSnapshot[]> {
  const db = env?.SOCIAL_DB;
  if (!db) return [];

  try {
    const { results } = await db
      .prepare(
        `SELECT id, tenant_id, saas_id, snapshot_json, post_count, created_at
         FROM socialcors_style_history
         WHERE tenant_id = ? AND saas_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
      )
      .bind(tenantId, saasId, STYLE_HISTORY_LOOKBACK)
      .all<StyleHistoryRow>();

    return (results ?? []).map(mapStyleHistoryRow);
  } catch (err) {
    console.error("[NicheIntelligenceService] getStyleHistory failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return [];
  }
}

// Appends a style-learning snapshot to history and prunes anything beyond the
// MAX_STYLE_SNAPSHOTS_PER_TENANT most recent rows for that tenant. Additive —
// does not touch the auto_learned_style knowledge document (see
// upsertKnowledgeDocByType), which keeps overwriting as before for compatibility.
export async function saveStyleSnapshot(
  tenantId: string,
  saasId: string,
  snapshot: string,
  postCount: number,
  env: Env,
): Promise<void> {
  const db = env?.SOCIAL_DB;
  if (!db) return;

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db
      .prepare(
        `INSERT INTO socialcors_style_history (id, tenant_id, saas_id, snapshot_json, post_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, tenantId, saasId, snapshot, postCount, now)
      .run();

    await db
      .prepare(
        `DELETE FROM socialcors_style_history
         WHERE tenant_id = ? AND saas_id = ?
         AND id NOT IN (
           SELECT id FROM socialcors_style_history
           WHERE tenant_id = ? AND saas_id = ?
           ORDER BY created_at DESC
           LIMIT ?
         )`,
      )
      .bind(tenantId, saasId, tenantId, saasId, MAX_STYLE_SNAPSHOTS_PER_TENANT)
      .run();
  } catch (err) {
    console.error("[NicheIntelligenceService] saveStyleSnapshot failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Detects content fatigue by comparing the dominant hook pattern (topHookPatterns[0]
// from StyleLearningAgent's result, the only "type" dimension the snapshot payload
// carries today) across the most recent snapshots. Returns null when there isn't
// enough history yet or the pattern varies — never throws, callers treat this as
// advisory context, not a blocker.
export function detectContentFatigue(history: StyleSnapshot[]): FatigueWarning | null {
  if (history.length < FATIGUE_WINDOW) return null;

  const recent = history.slice(0, FATIGUE_WINDOW);
  const dominantPatterns = recent.map((snapshot) => {
    const parsed = safeParseObject(snapshot.snapshotJson);
    const patterns = parsed?.topHookPatterns;
    return Array.isArray(patterns) && typeof patterns[0] === "string" ? patterns[0] : null;
  });

  if (dominantPatterns.some((pattern) => !pattern)) return null;

  const [first, ...rest] = dominantPatterns;
  if (!rest.every((pattern) => pattern === first)) return null;

  return {
    dominantPattern: first as string,
    occurrences: recent.length,
    description: `Los últimos ${recent.length} análisis de estilo muestran el mismo patrón de hook dominante ("${first}"). Varía el formato/hook esta vez.`,
  };
}
