import { defaultLocalModel } from "../models/localModel";
import { resolveSocialContext, listSaasSocialPosts } from "@/lib/socialflow/repository";
import { getChannelProfile } from "@/lib/socialflow/profile/repository";
import { resolveNicheSlug, type Env } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { seedFeedItems, dismissFeedItemsBySource } from "@/lib/socialflow/intelligence/repository";
import type { IntelligenceFeedPriority } from "@/lib/socialflow/intelligence/types";
import { env, type DracoEnv } from "@/lib/cf";

const LOOKAHEAD_DAYS = 21;
const SOURCE_PREFIX = "seasonal";

// Algoritmo de Gauss/Meeus (anónimo gregoriano) — matemática de calendario pura, sin
// llamadas externas, para el Domingo de Resurrección de un año dado.
function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month0 = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month0, day));
}

// N-ésima ocurrencia de un día de la semana en un mes (weekday: 0=domingo..6=sábado) —
// usado para Black Friday (4º viernes de noviembre) y Día de la Madre en España (1er
// domingo de mayo). Matemática de calendario pura, sin APIs externas.
function nthWeekdayOfMonth(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month0, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month0, 1 + offset + (n - 1) * 7));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

type SeasonalEvent = {
  id: string;
  name: string;
  niches: string[];
  keywords: string[];
  getDateForYear: (year: number) => Date;
};

// Calendario curado (no cubre los 66 nichos para cada evento) — pensado para ampliarse.
// Fechas móviles calculadas con matemática de calendario, nunca vía API externa.
const SEASONAL_EVENTS: SeasonalEvent[] = [
  {
    id: "ano_nuevo",
    name: "Año Nuevo",
    niches: ["fitness", "gimnasio", "nutricion", "nutricion_deportiva", "coach_vida", "mindfulness", "centro_deportivo", "running", "crossfit", "yoga"],
    keywords: ["año nuevo", "propositos", "propósitos", "1 de enero"],
    getDateForYear: (year) => new Date(Date.UTC(year, 0, 1)),
  },
  {
    id: "rebajas_enero",
    name: "Rebajas de enero",
    niches: ["tienda_ropa", "ecommerce_general", "optica", "joyeria"],
    keywords: ["rebajas", "rebajas de enero", "black friday de enero"],
    getDateForYear: (year) => new Date(Date.UTC(year, 0, 7)),
  },
  {
    id: "san_valentin",
    name: "San Valentín",
    niches: ["restauracion", "bar_copas", "cafeteria", "pasteleria", "joyeria", "floristerias", "tienda_ropa", "estetica_spa", "eventos_bodas", "fotografia_bodas", "hotel"],
    keywords: ["san valentin", "san valentín", "14 de febrero", "dia de los enamorados", "día de los enamorados"],
    getDateForYear: (year) => new Date(Date.UTC(year, 1, 14)),
  },
  {
    id: "dia_del_padre",
    name: "Día del Padre",
    niches: ["joyeria", "tienda_ropa", "restauracion", "automocion"],
    keywords: ["dia del padre", "día del padre", "19 de marzo"],
    getDateForYear: (year) => new Date(Date.UTC(year, 2, 19)),
  },
  {
    id: "semana_santa",
    name: "Semana Santa",
    niches: ["agencia_viajes", "hotel", "restauracion", "gastronomia_local"],
    keywords: ["semana santa", "pascua", "vacaciones de semana santa"],
    getDateForYear: (year) => computeEasterSunday(year),
  },
  {
    id: "dia_de_la_madre",
    name: "Día de la Madre",
    niches: ["floristerias", "joyeria", "restauracion", "pasteleria", "estetica_spa", "fotografia_profesional"],
    keywords: ["dia de la madre", "día de la madre"],
    getDateForYear: (year) => nthWeekdayOfMonth(year, 4, 0, 1),
  },
  {
    id: "operacion_verano",
    name: "Operación Verano",
    niches: ["fitness", "gimnasio", "nutricion", "nutricion_deportiva", "centro_deportivo", "estetica_spa", "crossfit", "running", "yoga", "tienda_ropa"],
    keywords: ["operacion verano", "operación verano", "operacion bikini", "operación bikini", "reto verano"],
    getDateForYear: (year) => new Date(Date.UTC(year, 3, 15)),
  },
  {
    id: "vuelta_al_cole",
    name: "Vuelta al Cole",
    niches: ["academia_idiomas", "academia_infantil", "academia_oposiciones", "educacion", "tienda_ropa"],
    keywords: ["vuelta al cole", "vuelta al colegio", "inicio de curso"],
    getDateForYear: (year) => new Date(Date.UTC(year, 8, 8)),
  },
  {
    id: "halloween",
    name: "Halloween",
    niches: ["bar_copas", "restauracion", "academia_infantil", "tienda_ropa", "cafeteria"],
    keywords: ["halloween", "31 de octubre", "noche de brujas"],
    getDateForYear: (year) => new Date(Date.UTC(year, 9, 31)),
  },
  {
    id: "black_friday",
    name: "Black Friday",
    niches: ["ecommerce_general", "tienda_ropa", "joyeria", "optica", "automocion", "tecnologia"],
    keywords: ["black friday", "viernes negro"],
    getDateForYear: (year) => nthWeekdayOfMonth(year, 10, 5, 4),
  },
  {
    id: "cyber_monday",
    name: "Cyber Monday",
    niches: ["ecommerce_general", "tecnologia"],
    keywords: ["cyber monday"],
    getDateForYear: (year) => addDays(nthWeekdayOfMonth(year, 10, 5, 4), 3),
  },
  {
    id: "navidad",
    name: "Navidad",
    niches: ["restauracion", "pasteleria", "joyeria", "tienda_ropa", "ecommerce_general", "hotel", "bar_copas", "floristerias", "fotografia_profesional"],
    keywords: ["navidad", "25 de diciembre", "feliz navidad"],
    getDateForYear: (year) => new Date(Date.UTC(year, 11, 25)),
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Próxima ocurrencia de un evento desde hoy — si la fecha de este año ya pasó, usa la
// del año siguiente. daysUntil incluye el día de hoy como 0.
function nextOccurrence(event: SeasonalEvent, todayStart: Date): { date: Date; daysUntil: number } {
  const thisYear = event.getDateForYear(todayStart.getUTCFullYear());
  const candidate = thisYear.getTime() >= todayStart.getTime() ? thisYear : event.getDateForYear(todayStart.getUTCFullYear() + 1);
  const daysUntil = Math.round((candidate.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));
  return { date: candidate, daysUntil };
}

function priorityFor(daysUntil: number): IntelligenceFeedPriority {
  if (daysUntil <= 7) return "high";
  if (daysUntil <= 14) return "medium";
  return "low";
}

function isAlreadyCovered(event: SeasonalEvent, publishedCorpus: string): boolean {
  return event.keywords.some((k) => publishedCorpus.includes(normalizeText(k)));
}

function buildSuggestionPrompt(event: SeasonalEvent, daysUntil: number, niche: string, tone: string, personality: string): string {
  return `Eres un estratega de contenido para el nicho "${niche}". Tono de marca: ${tone || "no especificado"}. Personalidad: ${personality || "no especificada"}.

Se acerca "${event.name}" (en ${daysUntil} días). Sugiere UNA idea de contenido concreta y accionable para este cliente, aprovechando esta fecha, coherente con su tono de marca (máximo 2 frases, en español, sin inventar datos ni promociones que no te haya dado el cliente).

Responde SOLO con un objeto JSON válido, sin markdown ni backticks, con esta forma exacta:
{"contentSuggestion": "..."}`;
}

type SuggestionResult = { contentSuggestion: string; _meta?: { engine?: string } };

async function generateContentSuggestion(
  event: SeasonalEvent,
  daysUntil: number,
  niche: string,
  tone: string,
  personality: string,
  tenantId: string,
  saasId: string,
): Promise<string> {
  const { data } = await defaultLocalModel.generateStructured<SuggestionResult>(
    { prompt: buildSuggestionPrompt(event, daysUntil, niche, tone, personality), tenantId, saasId },
    () => ({ contentSuggestion: "" }) as SuggestionResult,
  );

  if (data._meta?.engine === "workers-ai" && typeof data.contentSuggestion === "string" && data.contentSuggestion.trim()) {
    return data.contentSuggestion.trim();
  }
  return `Prepara contenido sobre "${event.name}" para tu audiencia de ${niche} antes de que llegue la fecha.`;
}

export type SeasonalOpportunity = {
  event: string;
  daysUntil: number;
  priority: IntelligenceFeedPriority;
  contentSuggestion: string;
};

export type SeasonalOpportunityResult = {
  upcomingOpportunities: SeasonalOpportunity[];
};

function feedSourceFor(eventId: string, year: number): string {
  return `${SOURCE_PREFIX}:${eventId}:${year}`;
}

// Calendario hardcodeado de eventos estacionales por nicho (sin APIs externas — fechas
// móviles calculadas con matemática de calendario pura) que anticipa fechas relevantes
// con 21 días de antelación y sugiere contenido específico usando el perfil de marca del
// cliente. Complementario a SeasonalityAgent (contexto MENSUAL vía Mistral,
// socialflow_seasonality_cache) — este agente trabaja con fechas EXACTAS y cuenta
// regresiva. Genera tarjetas "opportunity" en el Intelligence Feed (seedFeedItems/
// dismissFeedItemsBySource, source por evento+año). Persiste en
// socialcors_seasonal_opportunities (tabla propia por tenant, migración 0233) para que
// el chat lea el snapshot ya calculado en vez de recalcular en cada mensaje.
export class SeasonalOpportunityAgent {
  async run(input: { tenantId: string; saasId: string; accountType?: "influencer" | "empresa" }): Promise<SeasonalOpportunityResult | null> {
    const dracoEnv = env();
    if (!dracoEnv?.SOCIAL_DB) return null;

    const profile = await getChannelProfile(input.tenantId, input.saasId);
    if (!profile.niche) return null;

    const nicheSlug = await resolveNicheSlug(profile.niche, dracoEnv.SOCIAL_DB, input.tenantId, input.saasId).catch(() => "");
    if (!nicheSlug) return null;

    const todayStart = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

    const relevantEvents = SEASONAL_EVENTS
      .filter((e) => e.niches.includes(nicheSlug))
      .map((e) => ({ event: e, ...nextOccurrence(e, todayStart) }))
      .filter((e) => e.daysUntil >= 0 && e.daysUntil <= LOOKAHEAD_DAYS);

    const ctx = await resolveSocialContext({ tenantId: input.tenantId, saasId: input.saasId });
    const posts = await listSaasSocialPosts(ctx);
    const yearStart = new Date(Date.UTC(todayStart.getUTCFullYear(), 0, 1)).getTime();
    const publishedCorpus = normalizeText(
      posts
        .filter((p) => p.status === "POSTED" || p.status === "PUBLISHED")
        .filter((p) => new Date(p.postedAt ?? p.updatedAt).getTime() >= yearStart)
        .map((p) => `${p.title ?? ""} ${p.body ?? ""}`)
        .join(" "),
    );

    const notYetCovered = relevantEvents.filter((e) => !isAlreadyCovered(e.event, publishedCorpus));

    const upcomingOpportunities: SeasonalOpportunity[] = await Promise.all(
      notYetCovered.map(async ({ event, daysUntil }) => ({
        event: event.name,
        daysUntil,
        priority: priorityFor(daysUntil),
        contentSuggestion: await generateContentSuggestion(
          event,
          daysUntil,
          profile.niche,
          profile.toneOfVoice,
          profile.personality,
          input.tenantId,
          input.saasId,
        ),
      })),
    );

    await syncSeasonalFeed(input.tenantId, input.saasId, notYetCovered.map((e) => ({ id: e.event.id, year: e.date.getUTCFullYear() })));

    const result: SeasonalOpportunityResult = { upcomingOpportunities };

    for (const { event, daysUntil, date } of notYetCovered) {
      const opportunity = upcomingOpportunities.find((o) => o.event === event.name);
      if (!opportunity) continue;
      await seedFeedItems(
        input.tenantId,
        [
          {
            type: "opportunity" as const,
            priority: opportunity.priority,
            title: `${event.name} en ${daysUntil} día${daysUntil === 1 ? "" : "s"}`,
            description: opportunity.contentSuggestion,
            source: feedSourceFor(event.id, date.getUTCFullYear()),
          },
        ],
        input.saasId,
      );
    }

    await upsertSeasonalOpportunities(input.tenantId, input.saasId, JSON.stringify(result), dracoEnv);
    return result;
  }
}

// --- Intelligence Feed: retira alertas de eventos que ya no califican (cubiertos por un
// post nuevo, o fuera de la ventana de 21 días) — nunca se dejan huérfanas.
async function syncSeasonalFeed(
  tenantId: string,
  saasId: string,
  currentEvents: Array<{ id: string; year: number }>,
): Promise<void> {
  const currentSources = new Set(currentEvents.map((e) => feedSourceFor(e.id, e.year)));
  for (const event of SEASONAL_EVENTS) {
    for (const year of [new Date().getUTCFullYear(), new Date().getUTCFullYear() + 1]) {
      const source = feedSourceFor(event.id, year);
      if (!currentSources.has(source)) {
        await dismissFeedItemsBySource(tenantId, source, saasId).catch(() => {});
      }
    }
  }
}

// --- Persistencia (tabla propia por tenant, ver migración 0233) -------------------

async function upsertSeasonalOpportunities(tenantId: string, saasId: string, snapshot: string, dracoEnv: DracoEnv): Promise<void> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return;

  try {
    const now = new Date().toISOString();
    const existing = await db
      .prepare(`SELECT id FROM socialcors_seasonal_opportunities WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ id: string }>();

    if (existing) {
      await db
        .prepare(`UPDATE socialcors_seasonal_opportunities SET snapshot_json = ?, updated_at = ? WHERE id = ?`)
        .bind(snapshot, now, existing.id)
        .run();
      return;
    }

    await db
      .prepare(
        `INSERT INTO socialcors_seasonal_opportunities (id, tenant_id, saas_id, snapshot_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), tenantId, saasId, snapshot, now, now)
      .run();
  } catch (err) {
    console.error("[SeasonalOpportunityAgent] upsertSeasonalOpportunities failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
  }
}

// Lectura barata para el chat — nunca vuelve a leer posts ni a llamar a Mistral, solo el
// snapshot que ya calculó el cron diario.
export async function getLatestSeasonalOpportunities(
  tenantId: string,
  saasId: string,
  dracoEnv: DracoEnv,
): Promise<SeasonalOpportunityResult | null> {
  const db = dracoEnv?.SOCIAL_DB;
  if (!db) return null;

  try {
    const row = await db
      .prepare(`SELECT snapshot_json FROM socialcors_seasonal_opportunities WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
      .bind(tenantId, saasId)
      .first<{ snapshot_json: string }>();

    if (!row) return null;
    return JSON.parse(row.snapshot_json) as SeasonalOpportunityResult;
  } catch (err) {
    console.error("[SeasonalOpportunityAgent] getLatestSeasonalOpportunities failed", tenantId, saasId, err instanceof Error ? err.message : String(err));
    return null;
  }
}

export type SeasonalOpportunityTenantOutcome = { tenantId: string; saasId: string; ok: boolean; opportunitiesFound?: number; error?: string };

// Corre para todo tenant onboardeado (no gated por nº de posts, a diferencia del cron
// diario de style-learning — un tenant nuevo se beneficia igual de saber qué eventos se
// vienen) — mismo patrón de enumeración que runViralOpportunityCron/runViralMomentCron:
// nunca lanza por un tenant fallido, sigue con el resto.
export async function runSeasonalOpportunityCron(cronEnv: Env): Promise<SeasonalOpportunityTenantOutcome[]> {
  const db = cronEnv?.SOCIAL_DB;
  if (!db) return [];

  const { results: tenantRows } = await db.prepare(`SELECT DISTINCT tenant_id, saas_id FROM socialflow_profiles`).all<{
    tenant_id: string;
    saas_id: string;
  }>();

  const results: SeasonalOpportunityTenantOutcome[] = [];
  for (const row of tenantRows ?? []) {
    try {
      const outcome = await new SeasonalOpportunityAgent().run({ tenantId: row.tenant_id, saasId: row.saas_id });
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: true, opportunitiesFound: outcome?.upcomingOpportunities.length ?? 0 });
    } catch (err) {
      console.error("[SeasonalOpportunityAgent] tenant failed", row.tenant_id, err instanceof Error ? err.message : String(err));
      results.push({ tenantId: row.tenant_id, saasId: row.saas_id, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
