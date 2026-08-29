import type { DracoEnv } from "@/lib/cf";
import { defaultLocalModel } from "@/lib/socialflow/ai/models/localModel";
import { getChannelProfile, upsertChannelProfile } from "@/lib/socialflow/profile/repository";

export type Env = DracoEnv;

export type NicheOptimalHour = { day: string; hour: number; score: number };

export type NicheIntelligence = {
  niche: string;
  analysis: Record<string, unknown> | null;
  hashtags: string[];
  formats: string[];
  hooks: string[];
  optimalHours: NicheOptimalHour[];
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

export function safeParseObject(json: string | null | undefined): Record<string, unknown> | null {
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

// profile.niche es texto libre que el cliente escribió en onboarding (ej. "Fitness y
// lifestyle para mujeres hispanohablantes") — nunca coincide con los slugs
// normalizados de socialcors_niche_intelligence (ej. "fitness"). Sin esto, el WHERE
// niche = ? de abajo nunca matchea para ningún cliente real (ver auditoría "Sprint C
// — bug crítico" 2026-08-07). NFD + strip diacríticos + minúsculas, para que acentos
// y mayúsculas no rompan ni el match exacto ni el parcial.
function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Nivel 2.5 — sinónimos por palabra clave (substring, no frase completa) para nichos
// compuestos donde el cliente solo escribe la palabra específica sin el modificador del
// slug (ej. "Dentista" nunca contiene la frase "clinica dental" que exige el nivel 2 de
// arriba). Se comprueba DESPUÉS del regex de frase completa a propósito — así nunca tapa
// un match ya preciso de hoy (ej. "yoga"/"crossfit"/"gaming"/"cafeteria"/"peluqueria" ya
// resuelven correctamente a su propio slug standalone vía el nivel 2).
const NICHE_SYNONYMS: Record<string, string[]> = {
  clinica_dental: ["dentista", "odontolog", "dental"],
  clinica_fisioterapia: ["fisioterapia", "fisioterapeuta", "kinesiol"],
  clinica_medica: ["medico", "medicina", "clinica", "salud"],
  restauracion: ["restaurante", "bar", "cafeteria", "hosteleria"],
  estetica_spa: ["estetica", "spa", "belleza", "depilacion"],
  peluqueria_barberia: ["peluqueria", "barberia", "peluquero", "barbero"],
  tatuajes_piercing: ["tatuaje", "tattoo", "piercing"],
  tienda_ropa: ["ropa", "moda", "boutique", "textil"],
  fotografia_bodas: ["boda", "wedding", "nupcial"],
  nutricion_deportiva: ["nutricion", "nutricionista", "dietista", "dieta"],
  fitness: ["gym", "gimnasio", "entrena", "workout", "crossfit", "yoga", "pilates"],
  coach_vida: ["coach", "coaching", "mentor", "mentoria"],
  videojuegos_streaming: ["gaming", "gamer", "streamer", "twitch", "videojuego"],
};

// Cuatro niveles, del más barato al más caro — nunca se salta al siguiente si el
// anterior ya resolvió. Devuelve "" (nunca null/undefined) cuando no hay match
// razonable en ningún nivel; getNicheIntelligence trata "" igual que un niche vacío.
export async function normalizeNiche(
  profileNiche: string,
  availableNiches: string[],
  tenantId?: string,
  saasId?: string,
): Promise<string> {
  const trimmed = profileNiche.trim();
  if (!trimmed || availableNiches.length === 0) return "";

  const trimmedLower = trimmed.toLowerCase();
  const exact = availableNiches.find((n) => n.toLowerCase() === trimmedLower);
  if (exact) return exact;

  const normalizedProfile = normalizeForMatch(trimmed);
  const partial = availableNiches.find((slug) => {
    const normalizedSlug = normalizeForMatch(slug.replace(/_/g, " "));
    return new RegExp(`\\b${escapeRegExp(normalizedSlug)}\\b`).test(normalizedProfile);
  });
  if (partial) return partial;

  // Nivel 2.5 — sinónimos (ver NICHE_SYNONYMS arriba). Validado contra availableNiches
  // antes de devolverse — mismo criterio anti-alucinación que el nivel de Mistral: nunca
  // confiar en un slug que no exista de verdad en la tabla.
  for (const [slug, keywords] of Object.entries(NICHE_SYNONYMS)) {
    if (!availableNiches.includes(slug)) continue;
    if (keywords.some((keyword) => normalizedProfile.includes(normalizeForMatch(keyword)))) {
      return slug;
    }
  }

  // Nivel 3 — Mistral. defaultLocalModel ya resuelve el binding de IA internamente
  // (env() de @/lib/cf) y degrada al seed determinista si no está disponible, así
  // que no hace falta comprobar env.AI aquí — un fallo simplemente devuelve slug: "".
  const prompt = `Clasifica este nicho de negocio en el slug MÁS CERCANO de esta lista (responde EXACTAMENTE uno de estos):
${availableNiches.join(", ")}

Nicho del cliente: "${trimmed}"

Responde SOLO con el slug exacto de la lista, sin explicación.`;

  const { data } = await defaultLocalModel.generateStructured<{ slug: string }>(
    { prompt, tenantId, saasId },
    () => ({ slug: "" }),
  );

  // Nunca confiar ciegamente en el output de un LLM para esto — si devuelve algo que
  // no está literalmente en la lista (alucinación), se descarta.
  return typeof data.slug === "string" && availableNiches.includes(data.slug) ? data.slug : "";
}

// Caché en el propio registro del perfil (ChannelProfile.normalizedNicheSlug) para no
// llamar a Mistral (nivel 3) en cada request — válida solo mientras
// normalizedNicheSourceText siga siendo exactamente profile.niche (auto-invalidación
// si el cliente edita su nicho, sin enganchar el flujo de update del perfil).
// Exported for CrossTenantIntelligenceAgent, which needs to resolve each tenant's
// free-text niche to the same slug space as socialcors_niche_intelligence before it
// can group tenants by niche — same cache semantics as the getNicheIntelligence path.
export async function resolveNicheSlug(
  rawNiche: string,
  db: NonNullable<Env["SOCIAL_DB"]>,
  tenantId?: string,
  saasId?: string,
): Promise<string> {
  if (tenantId && saasId) {
    try {
      const profile = await getChannelProfile(tenantId, saasId);
      if (profile.normalizedNicheSlug && profile.normalizedNicheSourceText === rawNiche) {
        return profile.normalizedNicheSlug;
      }
    } catch (err) {
      console.error("[NicheIntelligenceService] cache lookup failed, falling back to fresh normalization", err instanceof Error ? err.message : String(err));
    }
  }

  const { results } = await db.prepare(`SELECT DISTINCT niche FROM socialcors_niche_intelligence`).all<{ niche: string }>();
  const availableNiches = (results ?? []).map((r) => r.niche);
  const resolved = await normalizeNiche(rawNiche, availableNiches, tenantId, saasId);

  if (resolved && tenantId && saasId) {
    // Fire-and-forget — una escritura de caché nunca debe añadir latencia al path de
    // generación de contenido.
    void upsertChannelProfile(tenantId, { normalizedNicheSlug: resolved, normalizedNicheSourceText: rawNiche }, saasId)
      .catch((err) => console.error("[NicheIntelligenceService] cache write failed", err instanceof Error ? err.message : String(err)));
  }

  return resolved;
}

// Cross-tenant, aggregated cache of "what's working this week" per niche — not
// scoped to a single tenant on purpose (see migration 0207). Returns null on any
// miss (not yet cached, expired, or DB error) so callers can degrade gracefully
// instead of blocking content generation: this cache is filled by a separate cron
// job, not by the generation path itself. tenantId/saasId opcionales — habilitan la
// normalización de nicho (ver resolveNicheSlug) y su caché; ausentes, se comporta
// igual que antes pero SIN normalizar (mismo bug de siempre para ese caller).
export async function getNicheIntelligence(
  rawNiche: string,
  env: Env,
  tenantId?: string,
  saasId?: string,
): Promise<NicheIntelligence | null> {
  const db = env?.SOCIAL_DB;
  if (!db || !rawNiche) return null;

  try {
    const niche = await resolveNicheSlug(rawNiche, db, tenantId, saasId);
    if (!niche) return null;

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
      optimalHours: safeParseArray<NicheOptimalHour>(row.optimal_hours_json),
      fatigueSignals: safeParseArray<string>(row.fatigue_signals_json),
      updatedAt: row.updated_at,
      validUntil: row.valid_until,
    };
  } catch (err) {
    console.error("[NicheIntelligenceService] getNicheIntelligence failed", rawNiche, err instanceof Error ? err.message : String(err));
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
