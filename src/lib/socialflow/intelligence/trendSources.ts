// Fetchers de señales externas para TrendKeywordAgent — cada uno degrada a un valor
// vacío/nulo en cualquier fallo (key ausente, red caída, formato inesperado), nunca
// lanza. Ninguno usa un parser XML de librería: son extracciones por regex sobre texto
// estructurado, mismo criterio que el resto del código (ej. extractHashtags en
// contentHeuristics.ts) — evita meter una dependencia nueva solo para leer 2-3 campos.

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";
const GOOGLE_TRENDS_RSS_URL = "https://trends.google.com/trending/rss?geo=ES";
const MAX_YOUTUBE_RESULTS = 10;
const MAX_REDDIT_RESULTS = 10;
const MAX_TRENDS_RESULTS = 15;
const TOP_CHANNELS_N = 3;

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

type YoutubeSearchItem = { snippet?: { title?: string; channelTitle?: string; channelId?: string } };

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

export type YoutubeChannelBenchmark = {
  channelId: string;
  name: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  avgViews: number;
  topHooks: string[];
};

type YoutubeChannelListItem = {
  id?: string;
  snippet?: { title?: string };
  statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean };
};

// Dos llamadas: search.list (100 unidades, mismo query/ventana de 7 días que
// fetchYoutubeHooks) agrupado por channelId, luego una única channels.list (1 unidad,
// acepta hasta 50 ids separados por coma) con part=snippet,statistics para
// subscriberCount/viewCount/videoCount reales. NO hay una tercera llamada a
// playlistItems.list para "últimos vídeos" — channels.list no puede devolver eso, y en
// vez de gastar cuota extra se reusan los títulos que YA aparecieron en la búsqueda de
// arriba agrupados por canal (los vídeos más vistos del nicho esta semana que resultan
// pertenecer a ese canal — más relevante que "últimos uploads" del canal, que podrían
// no tener nada que ver con lo que está funcionando ahora).
export async function fetchTopYoutubeChannels(niche: string, apiKey: string): Promise<{ channels: YoutubeChannelBenchmark[]; ok: boolean }> {
  try {
    const query = buildYoutubeQuery(niche);
    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const searchUrl = new URL(YOUTUBE_SEARCH_URL);
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("order", "viewCount");
    searchUrl.searchParams.set("publishedAfter", publishedAfter);
    searchUrl.searchParams.set("maxResults", String(MAX_YOUTUBE_RESULTS));
    searchUrl.searchParams.set("regionCode", "ES");
    searchUrl.searchParams.set("relevanceLanguage", "es");
    searchUrl.searchParams.set("key", apiKey);

    const searchRes = await fetch(searchUrl.toString(), { cache: "no-store" });
    if (!searchRes.ok) return { channels: [], ok: false };

    const searchData = (await searchRes.json()) as { items?: YoutubeSearchItem[] };
    const titlesByChannel = new Map<string, string[]>();
    for (const item of searchData.items ?? []) {
      const channelId = item.snippet?.channelId;
      const title = item.snippet?.title;
      if (!channelId || !title) continue;
      const titles = titlesByChannel.get(channelId) ?? [];
      titles.push(title);
      titlesByChannel.set(channelId, titles);
    }

    const channelIds = Array.from(titlesByChannel.keys());
    if (!channelIds.length) return { channels: [], ok: true };

    const channelsUrl = new URL(YOUTUBE_CHANNELS_URL);
    channelsUrl.searchParams.set("part", "snippet,statistics");
    channelsUrl.searchParams.set("id", channelIds.join(","));
    channelsUrl.searchParams.set("key", apiKey);

    const channelsRes = await fetch(channelsUrl.toString(), { cache: "no-store" });
    if (!channelsRes.ok) return { channels: [], ok: false };

    const channelsData = (await channelsRes.json()) as { items?: YoutubeChannelListItem[] };
    const channels = (channelsData.items ?? [])
      .flatMap((item): YoutubeChannelBenchmark[] => {
        if (!item.id) return [];
        const totalViews = Number(item.statistics?.viewCount ?? 0);
        const videoCount = Number(item.statistics?.videoCount ?? 0);
        return [{
          channelId: item.id,
          name: item.snippet?.title ?? "Canal sin nombre",
          subscribers: item.statistics?.hiddenSubscriberCount ? 0 : Number(item.statistics?.subscriberCount ?? 0),
          totalViews,
          videoCount,
          avgViews: videoCount > 0 ? Math.round(totalViews / videoCount) : 0,
          topHooks: titlesByChannel.get(item.id) ?? [],
        }];
      })
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, TOP_CHANNELS_N);

    return { channels, ok: true };
  } catch {
    return { channels: [], ok: false };
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
