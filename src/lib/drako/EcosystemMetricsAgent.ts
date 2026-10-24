import { env, type DracoEnv } from "@/lib/cf";

// Métricas sociales públicas del ecosistema Drako (drako_ecosystem_metrics en DRACO_DB,
// migración 0206). fetchAndStore() lo llama el cron diario (/api/cron/ecosystem-metrics);
// getEcosystemSummary() lo usa la API pública (/api/ecosystem/metrics).
//
// Instagram/Facebook: Meta Graph API v21.0 con META_ACCESS_TOKEN. LinkedIn: API v2 con
// LINKEDIN_ACCESS_TOKEN. Sin token, sin cuenta configurada o si la API falla y no hay
// dato real previo, se guarda un mock razonable con source = 'mock' — el dashboard lo
// marca como dato de ejemplo para no hacerlo pasar por real.

const META_GRAPH = "https://graph.facebook.com/v21.0";
const LINKEDIN_API = "https://api.linkedin.com/v2";

export const ECOSYSTEM_PLATFORMS = ["instagram", "facebook", "linkedin"] as const;
export type EcosystemPlatform = (typeof ECOSYSTEM_PLATFORMS)[number];
export type EcosystemStatus = "active" | "beta" | "development";
export type MetricSource = "live" | "mock";

type EcosystemEnv = DracoEnv & {
  META_ACCESS_TOKEN?: string;
  // Cuenta IG Business dueña del token: desde ella se consulta business_discovery.
  // Si falta, se resuelve con /me/accounts.
  META_INSTAGRAM_USER_ID?: string;
  LINKEDIN_ACCESS_TOKEN?: string;
};

type SaasDefinition = {
  id: string;
  name: string;
  status: EcosystemStatus;
  progress: number;
  // Handle por plataforma (IG username, página de Facebook, vanity name de LinkedIn).
  accounts: Partial<Record<EcosystemPlatform, string>>;
};

export const ECOSYSTEM_SAAS: SaasDefinition[] = [
  { id: "drako", name: "Drako Systems", status: "active", progress: 75, accounts: { instagram: "drako.systems", linkedin: "drako-systems" } },
  { id: "socialflow", name: "Socialcors", status: "active", progress: 85, accounts: { instagram: "socialflow.app", linkedin: "socialflow-app" } },
  { id: "mentoria", name: "Mentoría", status: "beta", progress: 60, accounts: {} },
  { id: "crypto-ia", name: "Crypto IA", status: "development", progress: 40, accounts: {} },
  { id: "cazh", name: "Cazh", status: "development", progress: 25, accounts: {} },
  { id: "rentia", name: "Rentia", status: "development", progress: 20, accounts: {} },
];

export type PlatformMetrics = {
  followers: number;
  posts: number;
  engagementRate: number;
  reach7d: number;
  impressions7d: number;
  username: string | null;
  profileUrl: string | null;
  source: MetricSource;
};

export type SaasMetricsSummary = {
  id: string;
  name: string;
  status: EcosystemStatus;
  progress: number;
  platforms: Partial<Record<EcosystemPlatform, PlatformMetrics & { fetchedAt: string }>>;
};

export type EcosystemSummary = {
  lastUpdated: string | null;
  ecosystem: SaasMetricsSummary[];
};

type MetricsRow = {
  saas_id: string;
  platform: string;
  followers: number;
  posts: number;
  engagement_rate: number;
  reach_7d: number;
  impressions_7d: number;
  profile_url: string | null;
  username: string | null;
  source: string;
  fetched_at: string;
};

// followers, posts, engagement % por plataforma. Estables entre ejecuciones: un mock
// no debe simular crecimiento.
const MOCK_BASE: Record<string, Record<EcosystemPlatform, [number, number, number]>> = {
  drako: { instagram: [1850, 64, 3.4], facebook: [410, 22, 1.2], linkedin: [920, 28, 2.6] },
  socialflow: { instagram: [4200, 210, 4.1], facebook: [780, 60, 1.8], linkedin: [1350, 45, 2.9] },
  mentoria: { instagram: [640, 18, 3.2], facebook: [150, 8, 0.9], linkedin: [210, 6, 2.1] },
  "crypto-ia": { instagram: [380, 12, 2.4], facebook: [90, 5, 0.7], linkedin: [120, 4, 1.5] },
  cazh: { instagram: [220, 8, 2.0], facebook: [60, 2, 0.6], linkedin: [80, 3, 1.2] },
  rentia: { instagram: [150, 6, 1.8], facebook: [40, 2, 0.5], linkedin: [60, 2, 1.1] },
};

function profileUrlFor(platform: EcosystemPlatform, handle: string): string {
  if (platform === "instagram") return `https://www.instagram.com/${handle}/`;
  if (platform === "facebook") return `https://www.facebook.com/${handle}`;
  return `https://www.linkedin.com/company/${handle}/`;
}

function mockMetrics(saas: SaasDefinition, platform: EcosystemPlatform): PlatformMetrics {
  const [followers, posts, engagementRate] = MOCK_BASE[saas.id]?.[platform] ?? [0, 0, 0];
  const handle = saas.accounts[platform] ?? null;
  return {
    followers,
    posts,
    engagementRate,
    reach7d: Math.round(followers * 2.2),
    impressions7d: Math.round(followers * 3.5),
    username: handle,
    profileUrl: handle ? profileUrlFor(platform, handle) : null,
    source: "mock",
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} ${url.split("?")[0]}: ${body.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

// ── Meta ────────────────────────────────────────────────────────────────────

let cachedIgUserId: string | null = null;

async function resolveInstagramUserId(e: EcosystemEnv, token: string): Promise<string> {
  const configured = e.META_INSTAGRAM_USER_ID?.trim();
  if (configured) return configured;
  if (cachedIgUserId) return cachedIgUserId;
  const pages = await fetchJson<{ data?: { instagram_business_account?: { id: string } }[] }>(
    `${META_GRAPH}/me/accounts?fields=instagram_business_account&access_token=${encodeURIComponent(token)}`,
  );
  const id = pages.data?.find((p) => p.instagram_business_account?.id)?.instagram_business_account?.id;
  if (!id) throw new Error("META_NO_INSTAGRAM_BUSINESS_ACCOUNT");
  cachedIgUserId = id;
  return id;
}

async function fetchInstagram(e: EcosystemEnv, token: string, username: string): Promise<PlatformMetrics> {
  const igUserId = await resolveInstagramUserId(e, token);
  const fields = `business_discovery.username(${username}){id,username,followers_count,media_count,media.limit(12){like_count,comments_count}}`;
  const data = await fetchJson<{
    business_discovery?: {
      id: string;
      username: string;
      followers_count?: number;
      media_count?: number;
      media?: { data?: { like_count?: number; comments_count?: number }[] };
    };
  }>(`${META_GRAPH}/${igUserId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`);

  const account = data.business_discovery;
  if (!account) throw new Error(`META_BUSINESS_DISCOVERY_EMPTY ${username}`);
  const followers = account.followers_count ?? 0;
  const media = account.media?.data ?? [];
  const avgInteractions = media.length
    ? media.reduce((sum, m) => sum + (m.like_count ?? 0) + (m.comments_count ?? 0), 0) / media.length
    : 0;

  // Alcance solo disponible para la cuenta dueña del token (insights no aplica a
  // business_discovery de terceros).
  let reach7d = 0;
  if (account.id === igUserId) {
    try {
      const until = Math.floor(Date.now() / 1000);
      const since = until - 7 * 24 * 60 * 60;
      const insights = await fetchJson<{ data?: { values?: { value?: number }[] }[] }>(
        `${META_GRAPH}/${igUserId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`,
      );
      reach7d = (insights.data?.[0]?.values ?? []).reduce((sum, v) => sum + (v.value ?? 0), 0);
    } catch (error) {
      console.warn("ECOSYSTEM_IG_INSIGHTS_FAILED", error instanceof Error ? error.message : String(error));
    }
  }

  return {
    followers,
    posts: account.media_count ?? 0,
    engagementRate: followers > 0 ? round2((avgInteractions / followers) * 100) : 0,
    reach7d,
    impressions7d: 0,
    username: account.username,
    profileUrl: profileUrlFor("instagram", account.username),
    source: "live",
  };
}

async function fetchFacebook(token: string, page: string): Promise<PlatformMetrics> {
  const data = await fetchJson<{ username?: string; followers_count?: number; fan_count?: number; link?: string }>(
    `${META_GRAPH}/${encodeURIComponent(page)}?fields=username,followers_count,fan_count,link&access_token=${encodeURIComponent(token)}`,
  );
  const handle = data.username ?? page;
  return {
    followers: data.followers_count ?? data.fan_count ?? 0,
    posts: 0,
    engagementRate: 0,
    reach7d: 0,
    impressions7d: 0,
    username: handle,
    profileUrl: data.link ?? profileUrlFor("facebook", handle),
    source: "live",
  };
}

// ── LinkedIn ────────────────────────────────────────────────────────────────

async function fetchLinkedIn(token: string, vanityName: string): Promise<PlatformMetrics> {
  const headers = { Authorization: `Bearer ${token}`, "X-Restli-Protocol-Version": "2.0.0" };
  const orgs = await fetchJson<{ elements?: { id: number }[] }>(
    `${LINKEDIN_API}/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityName)}`,
    { headers },
  );
  const orgId = orgs.elements?.[0]?.id;
  if (!orgId) throw new Error(`LINKEDIN_ORG_NOT_FOUND ${vanityName}`);
  const urn = encodeURIComponent(`urn:li:organization:${orgId}`);

  const size = await fetchJson<{ firstDegreeSize?: number }>(
    `${LINKEDIN_API}/networkSizes/${urn}?edgeType=CompanyFollowedByMember`,
    { headers },
  );

  // Estadísticas de publicaciones: requieren r_organization_social / admin; si no hay
  // permiso se quedan a 0 sin invalidar los seguidores.
  let engagementRate = 0;
  let posts = 0;
  let impressions = 0;
  try {
    const stats = await fetchJson<{
      elements?: { totalShareStatistics?: { engagement?: number; shareCount?: number; impressionCount?: number } }[];
    }>(`${LINKEDIN_API}/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=${urn}`, { headers });
    const totals = stats.elements?.[0]?.totalShareStatistics;
    engagementRate = round2((totals?.engagement ?? 0) * 100);
    posts = totals?.shareCount ?? 0;
    impressions = totals?.impressionCount ?? 0;
  } catch (error) {
    console.warn("ECOSYSTEM_LINKEDIN_STATS_FAILED", error instanceof Error ? error.message : String(error));
  }

  return {
    followers: size.firstDegreeSize ?? 0,
    posts,
    engagementRate,
    reach7d: 0,
    impressions7d: impressions,
    username: vanityName,
    profileUrl: profileUrlFor("linkedin", vanityName),
    source: "live",
  };
}

// ── D1 ──────────────────────────────────────────────────────────────────────

function requireDb(): D1Database {
  const db = env()?.DRACO_DB;
  if (!db) throw new Error("DRACO_DB not configured");
  return db;
}

async function readLatestRows(db: D1Database): Promise<MetricsRow[]> {
  const rows = await db
    .prepare(
      `SELECT m.saas_id, m.platform, m.followers, m.posts, m.engagement_rate, m.reach_7d, m.impressions_7d,
              m.profile_url, m.username, m.source, m.fetched_at
       FROM drako_ecosystem_metrics m
       JOIN (
         SELECT saas_id, platform, MAX(fetched_at) AS fetched_at
         FROM drako_ecosystem_metrics
         GROUP BY saas_id, platform
       ) latest
         ON latest.saas_id = m.saas_id AND latest.platform = m.platform AND latest.fetched_at = m.fetched_at`,
    )
    .all<MetricsRow>();
  return rows.results ?? [];
}

function rowToMetrics(row: MetricsRow): PlatformMetrics & { fetchedAt: string } {
  return {
    followers: row.followers,
    posts: row.posts,
    engagementRate: row.engagement_rate,
    reach7d: row.reach_7d,
    impressions7d: row.impressions_7d,
    username: row.username,
    profileUrl: row.profile_url,
    source: row.source === "mock" ? "mock" : "live",
    fetchedAt: row.fetched_at,
  };
}

function buildSummary(rows: MetricsRow[]): EcosystemSummary {
  const byKey = new Map(rows.map((row) => [`${row.saas_id}:${row.platform}`, row]));
  let lastUpdated: string | null = null;
  const ecosystem = ECOSYSTEM_SAAS.map((saas) => {
    const platforms: SaasMetricsSummary["platforms"] = {};
    for (const platform of ECOSYSTEM_PLATFORMS) {
      const row = byKey.get(`${saas.id}:${platform}`);
      if (!row) continue;
      platforms[platform] = rowToMetrics(row);
      if (!lastUpdated || row.fetched_at > lastUpdated) lastUpdated = row.fetched_at;
    }
    return { id: saas.id, name: saas.name, status: saas.status, progress: saas.progress, platforms };
  });
  return { lastUpdated, ecosystem };
}

// Resumen solo con mocks — lo devuelve la API mientras la tabla está vacía (antes de la
// primera ejecución del cron) o si D1 no responde.
export function buildMockSummary(): EcosystemSummary {
  const fetchedAt = new Date().toISOString();
  return {
    lastUpdated: null,
    ecosystem: ECOSYSTEM_SAAS.map((saas) => ({
      id: saas.id,
      name: saas.name,
      status: saas.status,
      progress: saas.progress,
      platforms: Object.fromEntries(
        ECOSYSTEM_PLATFORMS.map((platform) => [platform, { ...mockMetrics(saas, platform), fetchedAt }]),
      ),
    })),
  };
}

export async function getEcosystemSummary(): Promise<EcosystemSummary> {
  const rows = await readLatestRows(requireDb());
  return rows.length ? buildSummary(rows) : buildMockSummary();
}

export type FetchAndStoreResult = {
  fetchedAt: string;
  stored: { saasId: string; platform: EcosystemPlatform; source: MetricSource; followers: number }[];
  skipped: { saasId: string; platform: EcosystemPlatform; reason: string }[];
  summary: EcosystemSummary;
};

export const EcosystemMetricsAgent = {
  async fetchAndStore(): Promise<FetchAndStoreResult> {
    const e = (env() ?? {}) as EcosystemEnv;
    const db = requireDb();
    const metaToken = e.META_ACCESS_TOKEN?.trim() || "";
    const linkedinToken = e.LINKEDIN_ACCESS_TOKEN?.trim() || "";
    const previous = new Map((await readLatestRows(db)).map((row) => [`${row.saas_id}:${row.platform}`, row]));
    const fetchedAt = new Date().toISOString();

    const stored: FetchAndStoreResult["stored"] = [];
    const skipped: FetchAndStoreResult["skipped"] = [];
    const statements: D1PreparedStatement[] = [];

    for (const saas of ECOSYSTEM_SAAS) {
      for (const platform of ECOSYSTEM_PLATFORMS) {
        const handle = saas.accounts[platform];
        const token = platform === "linkedin" ? linkedinToken : metaToken;
        let metrics: PlatformMetrics;

        if (!handle || !token) {
          metrics = mockMetrics(saas, platform);
        } else {
          try {
            metrics =
              platform === "instagram"
                ? await fetchInstagram(e, token, handle)
                : platform === "facebook"
                  ? await fetchFacebook(token, handle)
                  : await fetchLinkedIn(token, handle);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.error("ECOSYSTEM_METRICS_FETCH_FAILED", { saasId: saas.id, platform, reason });
            // Un fallo puntual de la API no pisa el último dato real con un mock.
            if (previous.get(`${saas.id}:${platform}`)?.source === "live") {
              skipped.push({ saasId: saas.id, platform, reason });
              continue;
            }
            metrics = mockMetrics(saas, platform);
          }
        }

        statements.push(
          db
            .prepare(
              `INSERT INTO drako_ecosystem_metrics
                 (saas_id, platform, followers, posts, engagement_rate, reach_7d, impressions_7d, profile_url, username, source, fetched_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              saas.id,
              platform,
              Math.round(metrics.followers),
              Math.round(metrics.posts),
              metrics.engagementRate,
              Math.round(metrics.reach7d),
              Math.round(metrics.impressions7d),
              metrics.profileUrl,
              metrics.username,
              metrics.source,
              fetchedAt,
              fetchedAt,
            ),
        );
        stored.push({ saasId: saas.id, platform, source: metrics.source, followers: metrics.followers });
      }
    }

    if (statements.length) await db.batch(statements);
    return { fetchedAt, stored, skipped, summary: await getEcosystemSummary() };
  },
};
