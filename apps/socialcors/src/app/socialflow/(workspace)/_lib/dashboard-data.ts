// Modelo de lectura del Dashboard — solo LEE datos ya existentes y los da forma para la UI.
//
// Fuentes reales (ninguna tabla nueva, ningún cambio de backend):
//  - saas_social_posts        → listSaasSocialPosts (posts programados / publicados)
//  - saas_social_metrics      → una fila por captura; se deduplica MAX(captured_at) por post
//                               (mismo patrón que getSocialAnalyticsSnapshot). Las filas
//                               post_id = "account:<id>" son las del historial de seguidores.
//  - saas_social_accounts     → listSaasSocialAccounts (estado de conexiones)
//  - getFollowerHistory       → historial de seguidores real (saas_social_metrics, cuenta IG)
//
// socialflow_social_metrics_snapshots NO sirve para histórico (UNIQUE por provider: solo la
// última fila) y socialflow_social_post_metrics no existe — ver comentario en repository.ts.
import type { SaasSocialContentType, SaasSocialPost } from "@/lib/social-core/types";
import {
  getFollowerHistory,
  listSaasSocialAccounts,
  listSaasSocialPosts,
  type SocialContext,
} from "@/lib/socialflow/repository";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type PostTypeLabel = "Post" | "Reel" | "Historia" | "Carrusel" | "Short";

export type PostMetrics = { likes: number; comments: number; shares: number; views: number };

export type FollowerPoint = { date: string; followers: number };

export type ViewsPoint = {
  id: string;
  label: string;
  dateLabel: string;
  excerpt: string;
  type: PostTypeLabel;
  views: number;
};

export type EngagementWeekPoint = { label: string; likes: number; comments: number; shares: number };

export type ScheduledPostItem = {
  id: string;
  scheduledAt: string;
  type: PostTypeLabel;
  provider: string;
  excerpt: string;
  thumbnail: string | null;
};

export type RecentPostItem = {
  id: string;
  type: PostTypeLabel;
  provider: string;
  postedAt: string;
  excerpt: string;
  thumbnail: string | null;
  metrics: { likes: number; comments: number; shares: number } | null;
};

export type ConnectionState = "connected" | "pending" | "needs_reconnection" | "disconnected";

export type DashboardData = {
  followers: { history: FollowerPoint[]; current: number | null; growth30d: number | null };
  viewsByPost: ViewsPoint[];
  engagementByWeek: EngagementWeekPoint[];
  engagement30d: { total: number; likes: number; comments: number; shares: number; publishedPosts: number };
  scheduledNext7Days: number;
  scheduledPosts: ScheduledPostItem[];
  recentPosts: RecentPostItem[];
  totalPublishedEver: number;
  instagram: ConnectionState;
  linkedin: ConnectionState;
};

type MetricsRow = {
  post_id: string;
  captured_at: string;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  metadata: string | null;
};

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// Visualizaciones: plays/videoViews (Reels) → impressions → reach. Es la misma jerarquía
// que usa el resto del producto (metadata.plays / videoViews, columna impressions).
function resolveViews(row: MetricsRow): number {
  const meta = parseJson(row.metadata);
  const plays = num(meta?.plays) || num(meta?.videoViews);
  if (plays > 0) return plays;
  const impressions = num(row.impressions);
  if (impressions > 0) return impressions;
  return num(meta?.reach);
}

export function postTypeLabel(contentType: SaasSocialContentType): PostTypeLabel {
  switch (contentType) {
    case "REEL": return "Reel";
    case "STORY": return "Historia";
    case "CAROUSEL": return "Carrusel";
    case "SHORT": return "Short";
    default: return "Post";
  }
}

function excerpt(post: SaasSocialPost, max = 110): string {
  const text = (post.body?.trim() || post.title?.trim() || "").replace(/\s+/g, " ");
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function isMediaUrl(value: string | null | undefined): value is string {
  return !!value && (value.startsWith("http://") || value.startsWith("https://"));
}

function thumbnailFor(post: SaasSocialPost): string | null {
  if (isMediaUrl(post.imageHint)) return post.imageHint;
  const slides = Array.isArray(post.metadata?.slides) ? (post.metadata.slides as unknown[]) : [];
  const first = slides.find((s): s is Record<string, unknown> => !!s && typeof s === "object");
  return first && isMediaUrl(first.imageUrl as string | undefined) ? (first.imageUrl as string) : null;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const CONNECTION_RANK: Record<ConnectionState, number> = { connected: 3, pending: 2, needs_reconnection: 1, disconnected: 0 };

function statusToState(status: string): ConnectionState {
  if (status === "CONNECTED_REAL") return "connected";
  if (status === "PENDING_REAL") return "pending";
  if (status === "NEEDS_RECONNECTION" || status === "INVALID_CREDENTIALS") return "needs_reconnection";
  return "disconnected";
}

// Un tenant puede tener varias cuentas del mismo proveedor: manda la mejor conectada.
function connectionState(accounts: { provider: string; status: string }[], provider: string): ConnectionState {
  return accounts
    .filter((a) => a.provider === provider)
    .map((a) => statusToState(a.status))
    .reduce<ConnectionState>((best, s) => (CONNECTION_RANK[s] > CONNECTION_RANK[best] ? s : best), "disconnected");
}

export async function loadDashboardData(ctx: SocialContext): Promise<DashboardData> {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * DAY_MS;

  const [posts, accounts, followerRows, metricRows] = await Promise.all([
    listSaasSocialPosts(ctx),
    listSaasSocialAccounts(ctx),
    getFollowerHistory(ctx, 30).catch(() => []),
    ctx.socialDb
      .prepare(
        `SELECT post_id, MAX(captured_at) AS captured_at, impressions, likes, comments, shares, metadata
         FROM saas_social_metrics
         WHERE tenant_id = ? AND saas_id = ? AND post_id NOT LIKE 'account:%' AND captured_at >= ?
         GROUP BY post_id`,
      )
      .bind(ctx.tenantId, ctx.saasId, new Date(now - 120 * DAY_MS).toISOString())
      .all<MetricsRow>()
      .then((r) => r.results ?? [])
      .catch(() => [] as MetricsRow[]),
  ]);

  const metricsByPost = new Map<string, PostMetrics>();
  for (const row of metricRows) {
    metricsByPost.set(row.post_id, {
      likes: num(row.likes),
      comments: num(row.comments),
      shares: num(row.shares),
      views: resolveViews(row),
    });
  }

  const published = posts
    .filter((p) => (p.status === "POSTED" || p.status === "PUBLISHED") && p.postedAt)
    .sort((a, b) => new Date(b.postedAt!).getTime() - new Date(a.postedAt!).getTime());
  const published30d = published.filter((p) => new Date(p.postedAt!).getTime() >= thirtyDaysAgo);

  // ── Seguidores: último valor de cada día ───────────────────────────────────
  const byDay = new Map<string, number>();
  for (const point of followerRows) byDay.set(point.capturedAt.slice(0, 10), point.followersCount);
  const followerHistory: FollowerPoint[] = Array.from(byDay.entries()).map(([date, followers]) => ({ date, followers }));
  const currentFollowers = followerHistory.length > 0 ? followerHistory[followerHistory.length - 1].followers : null;
  const growth30d = followerHistory.length >= 2 ? currentFollowers! - followerHistory[0].followers : null;

  // ── Visualizaciones por post (30 días) — solo posts con métricas reales ────
  const viewsByPost: ViewsPoint[] = published30d
    .filter((p) => metricsByPost.has(p.id))
    .sort((a, b) => new Date(a.postedAt!).getTime() - new Date(b.postedAt!).getTime())
    .map((p) => ({
      id: p.id,
      label: shortDate(p.postedAt!),
      dateLabel: new Date(p.postedAt!).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }),
      excerpt: excerpt(p, 90),
      type: postTypeLabel(p.contentType),
      views: metricsByPost.get(p.id)!.views,
    }));

  // ── Engagement (30 días): total + desglose semanal por fecha de publicación ─
  // 5 tramos de 7 días terminando hoy; el más antiguo se recorta a 30 días.
  const engagementByWeek: EngagementWeekPoint[] = [];
  for (let i = 4; i >= 0; i--) {
    const end = now - i * WEEK_MS;
    const start = Math.max(end - WEEK_MS, thirtyDaysAgo);
    const bucket: EngagementWeekPoint = {
      label: `${shortDate(new Date(start).toISOString())}–${shortDate(new Date(end - 1).toISOString())}`,
      likes: 0,
      comments: 0,
      shares: 0,
    };
    for (const p of published30d) {
      const t = new Date(p.postedAt!).getTime();
      const m = metricsByPost.get(p.id);
      if (!m || t < start || t >= end) continue;
      bucket.likes += m.likes;
      bucket.comments += m.comments;
      bucket.shares += m.shares;
    }
    engagementByWeek.push(bucket);
  }
  const engagement30d = { total: 0, likes: 0, comments: 0, shares: 0, publishedPosts: published30d.length };
  for (const w of engagementByWeek) {
    engagement30d.likes += w.likes;
    engagement30d.comments += w.comments;
    engagement30d.shares += w.shares;
  }
  engagement30d.total = engagement30d.likes + engagement30d.comments + engagement30d.shares;

  // ── Programados ────────────────────────────────────────────────────────────
  const scheduled = posts
    .filter((p) => p.status === "SCHEDULED" && p.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
  const scheduledNext7Days = scheduled.filter((p) => {
    const t = new Date(p.scheduledAt!).getTime();
    return t >= now && t < now + WEEK_MS;
  }).length;
  // Margen por los extremos: el calendario agrupa por día LOCAL del navegador.
  const scheduledPosts: ScheduledPostItem[] = scheduled
    .filter((p) => {
      const t = new Date(p.scheduledAt!).getTime();
      return t >= now - DAY_MS && t < now + WEEK_MS + DAY_MS;
    })
    .map((p) => ({
      id: p.id,
      scheduledAt: p.scheduledAt!,
      type: postTypeLabel(p.contentType),
      provider: p.provider,
      excerpt: excerpt(p, 70),
      thumbnail: thumbnailFor(p),
    }));

  // ── Últimas publicaciones ──────────────────────────────────────────────────
  const recentPosts: RecentPostItem[] = published.slice(0, 5).map((p) => {
    const m = metricsByPost.get(p.id);
    return {
      id: p.id,
      type: postTypeLabel(p.contentType),
      provider: p.provider,
      postedAt: p.postedAt!,
      excerpt: excerpt(p),
      thumbnail: thumbnailFor(p),
      metrics: m ? { likes: m.likes, comments: m.comments, shares: m.shares } : null,
    };
  });

  return {
    followers: { history: followerHistory, current: currentFollowers, growth30d },
    viewsByPost,
    engagementByWeek,
    engagement30d,
    scheduledNext7Days,
    scheduledPosts,
    recentPosts,
    totalPublishedEver: published.length,
    instagram: connectionState(accounts, "INSTAGRAM"),
    linkedin: connectionState(accounts, "LINKEDIN"),
  };
}

// Estado honesto cuando SOCIAL_DB no está disponible: todo vacío, nada inventado.
export function emptyDashboardData(): DashboardData {
  return {
    followers: { history: [], current: null, growth30d: null },
    viewsByPost: [],
    engagementByWeek: [],
    engagement30d: { total: 0, likes: 0, comments: 0, shares: 0, publishedPosts: 0 },
    scheduledNext7Days: 0,
    scheduledPosts: [],
    recentPosts: [],
    totalPublishedEver: 0,
    instagram: "disconnected",
    linkedin: "disconnected",
  };
}
