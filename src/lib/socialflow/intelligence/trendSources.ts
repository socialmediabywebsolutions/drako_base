// Fetchers de señales externas para TrendKeywordAgent — cada uno degrada a un valor
// vacío/nulo en cualquier fallo (key ausente, red caída, formato inesperado), nunca
// lanza. Ninguno usa un parser XML de librería: son extracciones por regex sobre texto
// estructurado, mismo criterio que el resto del código (ej. extractHashtags en
// contentHeuristics.ts) — evita meter una dependencia nueva solo para leer 2-3 campos.

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const GOOGLE_TRENDS_RSS_URL = "https://trends.google.com/trending/rss?geo=ES";
const MAX_YOUTUBE_RESULTS = 10;
const MAX_REDDIT_RESULTS = 10;
const MAX_TRENDS_RESULTS = 15;

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// Solo los nichos con actividad real y relevante en Reddit — el resto de los 55 nichos
// de NICHE_INTELLIGENCE_NICHES quedan fuera a propósito (ver auditoría: Reddit tiene
// muy poca actividad de negocio local hispanohablante — asesoría contable, floristerías,
// clínica dental, etc. no tienen un subreddit al que valga la pena preguntar).
export const NICHE_TO_SUBREDDIT: Record<string, string> = {
  fitness: "fitness",
  nutricion: "nutrition",
  cocina_recetas: "recipes",
  viajes: "travel",
  yoga: "yoga",
  running: "running",
  crossfit: "crossfit",
  mindfulness: "meditation",
  finanzas_personales: "personalfinance",
  emprendimiento: "entrepreneur",
  tecnologia: "technology",
  gaming: "gaming",
  musica: "WeAreTheMusicMakers",
};

// Queries en español para los nichos más comunes — para el resto de los 55, a diferencia
// de Reddit, siempre hay una query genérica derivable del slug (YouTube es la fuente
// principal, tiene que cubrir los 55, no solo un subconjunto).
const NICHE_TO_YOUTUBE_QUERY: Record<string, string> = {
  fitness: "fitness reels virales",
  nutricion: "nutrición tips virales",
  cocina_recetas: "recetas virales España",
  viajes: "viajes reels virales",
  yoga: "yoga reels virales",
  running: "running tips virales",
  crossfit: "crossfit reels virales",
  mindfulness: "mindfulness meditación virales",
  finanzas_personales: "finanzas personales tips virales",
  emprendimiento: "emprendimiento reels virales",
  tecnologia: "tecnología tips virales",
  gaming: "gaming reels virales",
  musica: "música reels virales",
};

export function buildYoutubeQuery(niche: string): string {
  return NICHE_TO_YOUTUBE_QUERY[niche] ?? `${niche.replace(/_/g, " ")} reels virales España`;
}

type YoutubeSearchItem = { snippet?: { title?: string; channelTitle?: string } };

// search.list, no videos.list — 100 unidades/llamada. Su snippet NO incluye viewCount
// (eso exigiría una segunda llamada a videos.list, más cuota) — el ranking por
// popularidad viene del parámetro order=viewCount, no de un campo de vistas que esta
// llamada no puede devolver.
export async function fetchYoutubeHooks(query: string, apiKey: string): Promise<{ hooks: string[]; ok: boolean }> {
  try {
    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const url = new URL(YOUTUBE_SEARCH_URL);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("q", query);
    url.searchParams.set("type", "video");
    url.searchParams.set("order", "viewCount");
    url.searchParams.set("publishedAfter", publishedAfter);
    url.searchParams.set("maxResults", String(MAX_YOUTUBE_RESULTS));
    url.searchParams.set("regionCode", "ES");
    url.searchParams.set("relevanceLanguage", "es");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return { hooks: [], ok: false };

    const data = (await res.json()) as { items?: YoutubeSearchItem[] };
    const hooks = (data.items ?? [])
      .flatMap((item) => (item.snippet?.title ? [item.snippet.title] : []));
    return { hooks, ok: true };
  } catch {
    return { hooks: [], ok: false };
  }
}

// .rss (Atom), no .json — confirmado en la auditoría que el endpoint JSON "sin
// autenticación" devuelve 403 (detección de bots por IP), mientras que .rss responde
// 200 sin ningún header especial. null = nicho sin subreddit mapeado (se salta del
// todo, no es lo mismo que "mapeado pero sin resultados").
export async function fetchRedditTopics(subreddit: string | undefined): Promise<string[] | null> {
  if (!subreddit) return null;
  try {
    const url = `https://www.reddit.com/r/${encodeURIComponent(subreddit)}/top/.rss?t=week&limit=${MAX_REDDIT_RESULTS}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "socialcors-trend-bot/1.0" },
    });
    if (!res.ok) return [];

    const xml = await res.text();
    const entries = xml.split("<entry>").slice(1);
    return entries.flatMap((chunk) => {
      const match = chunk.match(/<title>([^<]*)<\/title>/);
      return match ? [decodeXmlEntities(match[1])] : [];
    });
  } catch {
    return [];
  }
}

// Google Trends RSS no filtra por categoría (confirmado en la auditoría: mismo
// resultado con o sin &category=) — es una señal global de país, no por nicho, así que
// se llama una sola vez por ejecución del cron y se comparte entre todos los nichos.
export async function fetchGlobalTrends(): Promise<string[]> {
  try {
    const res = await fetch(GOOGLE_TRENDS_RSS_URL, { cache: "no-store" });
    if (!res.ok) return [];

    const xml = await res.text();
    const items = xml.split("<item>").slice(1);
    return items.slice(0, MAX_TRENDS_RESULTS).flatMap((chunk) => {
      const match = chunk.match(/<title>([^<]*)<\/title>/);
      return match ? [decodeXmlEntities(match[1])] : [];
    });
  } catch {
    return [];
  }
}
