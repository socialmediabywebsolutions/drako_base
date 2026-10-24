/**
 * CompetitorDiscoveryAgent
 *
 * Descubrimiento automático de competidores por nicho. Corre como cron semanal
 * (apps/socialcors/src/app/api/cron/social/competitor-discovery/route.ts) y
 * también puede invocarse manualmente por tenant.
 *
 * Flujo por tenant:
 *  1. Si el tenant ya tiene >= MIN_COMPETITORS_TO_SKIP docs de tipo "competitor"
 *     (manuales o auto-detectados) creados en los últimos REFRESH_DAYS días,
 *     se omite — no sobreescribe lo que el usuario introdujo a mano.
 *  2. Usa Mistral para sugerir CANDIDATES_PER_NICHE nombres/handles de
 *     cuentas referentes en el nicho + mercado hispanohablante.
 *  3. Por cada candidato, intenta construir una URL de perfil pública
 *     (Instagram, web corporativa) y lo pasa a analyzeCompetitorForKnowledgeBase()
 *     con dedupe=true y metadata.auto_detected=true.
 *  4. Los docs resultantes entran automáticamente en getKnowledgeContext() →
 *     ## COMPETITOR INTELLIGENCE → ContentGeneratorAgent sin ningún cambio adicional.
 *
 * Degradación: un candidato que falla (scraping bloqueado, Mistral timeout) no
 * detiene el resto. Un tenant que falla no detiene el batch global.
 */

import { defaultLocalModel } from "../ai/models/localModel";
import { analyzeCompetitorForKnowledgeBase } from "../knowledge/competitor-analysis";
import { countCompetitorDocs } from "../knowledge/repository";
import type { Env } from "./NicheIntelligenceService";

const MIN_COMPETITORS_TO_SKIP = 3;
const CANDIDATES_PER_NICHE = 5;
// Un doc auto-detectado creado hace más de 30 días se considera "caduco"
// y el tenant se re-procesa en el siguiente cron.
const REFRESH_DAYS = 30;

export type DiscoveryResult = {
  tenantId: string;
  saasId: string;
  niche: string;
  ok: boolean;
  skippedReason?: string;
  saved: number;
  errors: string[];
};

type CandidateList = {
  candidates: Array<{
    name: string;
    instagramHandle?: string;
    websiteUrl?: string;
  }>;
};

function buildDiscoveryPrompt(niche: string): string {
  return `Eres un analista de marketing digital especializado en el mercado hispanohablante.

Dado el nicho: "${niche}"

Identifica exactamente ${CANDIDATES_PER_NICHE} marcas, empresas o cuentas reales que sean referentes
competidoras en este nicho en España y Latinoamérica. Prioriza marcas conocidas con presencia activa
en redes sociales, no influencers personales salvo que sean muy reconocibles.

Para cada competidora, incluye:
- name: nombre real de la marca o cuenta (sin @)
- instagramHandle: handle de Instagram si lo conoces con certeza (sin @, omite si no estás seguro)
- websiteUrl: URL de su web corporativa si la conoces con certeza (omite si no estás seguro)

Responde SOLO con un objeto JSON válido, sin markdown, con esta forma exacta:
{
  "candidates": [
    { "name": "Nombre Real", "instagramHandle": "handle_opcional", "websiteUrl": "https://opcional.com" },
    ...
  ]
}

IMPORTANTE: Solo incluye datos que conozcas con certeza. Mejor omitir instagramHandle o websiteUrl
que inventarlos. El nombre sí es obligatorio.`;
}

async function suggestCompetitors(
  niche: string,
  tenantId: string,
  saasId: string,
): Promise<CandidateList["candidates"]> {
  const seed: CandidateList = { candidates: [] };
  const { data } = await defaultLocalModel.generateStructured<CandidateList>(
    { prompt: buildDiscoveryPrompt(niche), tenantId, saasId },
    () => seed,
  );
  if (!Array.isArray(data?.candidates)) return [];
  return data.candidates
    .filter((c) => c && typeof c.name === "string" && c.name.trim())
    .slice(0, CANDIDATES_PER_NICHE);
}

// Construye la URL más adecuada para scrapear: primero la web corporativa (más
// scrape-friendly que perfiles de RRSS), luego el perfil de Instagram.
function resolveCompetitorUrl(candidate: CandidateList["candidates"][0]): string | null {
  if (candidate.websiteUrl?.startsWith("http")) return candidate.websiteUrl;
  if (candidate.instagramHandle) {
    const h = candidate.instagramHandle.trim().replace(/^@/, "");
    if (h) return `https://www.instagram.com/${h}/`;
  }
  return null;
}

// Comprueba si el tenant ya tiene suficiente cobertura de competidores RECIENTE.
// Usa countCompetitorDocs (cuenta todos, manuales + auto) — si el usuario ya
// introdujo 3 o más competidores a mano, no los sobreescribimos.
async function hasEnoughRecentCoverage(
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  try {
    const count = await countCompetitorDocs(tenantId, saasId);
    return count >= MIN_COMPETITORS_TO_SKIP;
  } catch {
    return false;
  }
}

export async function runCompetitorDiscoveryForTenant(
  tenantId: string,
  saasId: string,
  niche: string,
): Promise<DiscoveryResult> {
  const base: DiscoveryResult = { tenantId, saasId, niche, ok: false, saved: 0, errors: [] };

  if (!niche?.trim()) {
    return { ...base, skippedReason: "NO_NICHE" };
  }

  // Skip si ya hay suficiente cobertura (manual o auto-detectada).
  const alreadyCovered = await hasEnoughRecentCoverage(tenantId, saasId).catch(() => false);
  if (alreadyCovered) {
    return { ...base, ok: true, skippedReason: "ALREADY_COVERED" };
  }

  // Sugerir candidatos via Mistral.
  let candidates: CandidateList["candidates"];
  try {
    candidates = await suggestCompetitors(niche, tenantId, saasId);
  } catch (err) {
    return {
      ...base,
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }

  if (!candidates.length) {
    return { ...base, ok: true, skippedReason: "NO_CANDIDATES_GENERATED" };
  }

  let saved = 0;
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const url = resolveCompetitorUrl(candidate);
      await analyzeCompetitorForKnowledgeBase({
        tenantId,
        saasId,
        name: candidate.name.trim(),
        url,
        dedupe: true,
        metadata: {
          auto_detected: true,
          source: "CompetitorDiscoveryAgent",
          discoveredAt: new Date().toISOString(),
          refreshDays: REFRESH_DAYS,
        },
      });
      saved++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[CompetitorDiscoveryAgent] candidate failed", candidate.name, msg);
      errors.push(`${candidate.name}: ${msg}`);
    }
  }

  return { ...base, ok: true, saved, errors };
}

export type CompetitorDiscoveryCronResult = {
  niche: string;
  tenantId: string;
  saasId: string;
  ok: boolean;
  skippedReason?: string;
  saved: number;
  errors: string[];
};

type ActiveTenantWithNiche = {
  tenantId: string;
  saasId: string;
  niche: string;
};

async function listTenantsWithNiche(
  db: NonNullable<Env["SOCIAL_DB"]>,
): Promise<ActiveTenantWithNiche[]> {
  // Usa saas_social_accounts (fuente de tenant activos, mismo criterio que
  // TrendTriggerConnector) cruzado con socialflow_profiles para obtener el nicho.
  const { results } = await db
    .prepare(
      `SELECT DISTINCT a.tenant_id, a.saas_id, p.niche
       FROM saas_social_accounts a
       JOIN socialflow_profiles p ON p.tenant_id = a.tenant_id AND p.saas_id = a.saas_id
       WHERE a.saas_id = 'socialflow'
         AND a.status != 'DISCONNECTED'
         AND p.niche IS NOT NULL
         AND p.niche != ''`,
    )
    .all<{ tenant_id: string; saas_id: string; niche: string }>();
  return (results ?? []).map((r) => ({
    tenantId: r.tenant_id,
    saasId: r.saas_id,
    niche: r.niche,
  }));
}

/**
 * Cron batch: itera todos los tenants activos con nicho definido,
 * omite los que ya tienen cobertura suficiente, descubre competidores
 * para el resto. Secuencial (no Promise.all) para respetar rate limits
 * de Workers AI (Mistral) y el scraper.
 */
export async function runCompetitorDiscoveryCron(
  env: Env,
): Promise<CompetitorDiscoveryCronResult[]> {
  const db = env?.SOCIAL_DB;
  if (!db) {
    return [{ niche: "", tenantId: "", saasId: "", ok: false, saved: 0, errors: ["SOCIAL_DB not configured"] }];
  }

  let tenants: ActiveTenantWithNiche[];
  try {
    tenants = await listTenantsWithNiche(db);
  } catch (err) {
    return [{ niche: "", tenantId: "", saasId: "", ok: false, saved: 0, errors: [err instanceof Error ? err.message : String(err)] }];
  }

  const results: CompetitorDiscoveryCronResult[] = [];

  for (const tenant of tenants) {
    try {
      const r = await runCompetitorDiscoveryForTenant(tenant.tenantId, tenant.saasId, tenant.niche);
      results.push({ ...r, niche: tenant.niche });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[CompetitorDiscoveryCron] tenant failed", tenant.tenantId, msg);
      results.push({ niche: tenant.niche, tenantId: tenant.tenantId, saasId: tenant.saasId, ok: false, saved: 0, errors: [msg] });
    }
  }

  return results;
}
