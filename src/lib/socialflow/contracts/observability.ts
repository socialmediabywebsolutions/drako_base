import {
  getSocialAnalyticsSnapshot,
  listSaasSocialAccounts,
  listSaasSocialPosts,
  resolveSocialContext,
} from "@/lib/socialflow/repository";
import {
  getObservabilityStatusSummary,
  listObservabilityActivities,
  listObservabilityIncidents,
  type ObservabilityActivity,
  type ObservabilityIncident,
  type ObservabilityStatusSummary,
} from "@/lib/observability-core";
import { listPublishActivities, type PublishActivity } from "@/lib/socialflow/publish-activity";
import type { SaasSocialAccount, SaasSocialPost, SaasSocialPostStatus } from "@/lib/social-core/types";

const POST_STATUSES: SaasSocialPostStatus[] = [
  "IDEA",
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "PUBLISHING",
  "POSTED",
  "PUBLISHED",
  "FAILED",
];

const STALE_PUBLISHING_MINUTES = 15;

export type SocialFlowOperatorPostSnapshot = {
  id: string;
  title: string;
  provider: string;
  status: SaasSocialPostStatus;
  scheduledAt: string | null;
  postedAt: string | null;
  updatedAt: string;
  externalPostId: string | null;
  attempts: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export type SocialFlowOperatorConnectionSnapshot = {
  id: string;
  provider: string;
  handle: string | null;
  displayName: string | null;
  status: string;
  isPrimary: boolean;
  updatedAt: string;
};

export type SocialFlowOperatorObservability = {
  tenantId: string;
  saasId: string;
  capturedAt: string;
  health: {
    status: "healthy" | "needs_attention" | "degraded" | "unknown";
    freshnessStatus: "fresh" | "stale" | "unknown";
    schedulerStatus: "idle" | "active" | "needs_attention";
    recommendation: string;
    openIncidentsCount: number;
    latestActivityAt: string | null;
    latestSnapshotAt: string | null;
  };
  scheduler: {
    scheduledPosts: number;
    dueScheduledPosts: number;
    publishingPosts: number;
    stalePublishingPosts: number;
    nextScheduledAt: string | null;
    lastPublishedAt: string | null;
  };
  posts: {
    total: number;
    byStatus: Record<SaasSocialPostStatus, number>;
    recentPublished: SocialFlowOperatorPostSnapshot[];
    recentFailed: SocialFlowOperatorPostSnapshot[];
    stalePublishing: SocialFlowOperatorPostSnapshot[];
  };
  publishing: {
    successLast30Days: number;
    failedLast30Days: number;
    successRateLast30Days: number;
    lastFailureAt: string | null;
  };
  linkedin: {
    connected: boolean;
    totalConnections: number;
    primaryStatus: string | null;
    connections: SocialFlowOperatorConnectionSnapshot[];
  };
  metrics: {
    last7Days: {
      engagement: number;
      publishedPosts: number;
      topProvider: string | null;
    };
    last30Days: {
      engagement: number;
      publishedPosts: number;
      topProvider: string | null;
    };
  };
  recentEvents: ObservabilityActivity[];
  recentIncidents: ObservabilityIncident[];
};

function getPublicationMetadata(post: SaasSocialPost): Record<string, unknown> {
  return typeof post.metadata?.publication === "object" && post.metadata.publication
    ? post.metadata.publication as Record<string, unknown>
    : {};
}

function getPostTime(post: SaasSocialPost): number {
  return Date.parse(post.postedAt ?? post.scheduledAt ?? post.updatedAt ?? post.createdAt);
}

function isWithinLast30Days(post: SaasSocialPost, now: number): boolean {
  const time = getPostTime(post);
  return !Number.isNaN(time) && time >= now - 30 * 24 * 60 * 60 * 1000;
}

function isStalePublishing(post: SaasSocialPost, now: number): boolean {
  if (post.status !== "PUBLISHING") return false;
  const updatedAt = Date.parse(post.updatedAt);
  if (Number.isNaN(updatedAt)) return false;
  return updatedAt < now - STALE_PUBLISHING_MINUTES * 60 * 1000;
}

function toPostSnapshot(post: SaasSocialPost): SocialFlowOperatorPostSnapshot {
  const publication = getPublicationMetadata(post);
  return {
    id: post.id,
    title: post.title,
    provider: post.provider,
    status: post.status,
    scheduledAt: post.scheduledAt,
    postedAt: post.postedAt,
    updatedAt: post.updatedAt,
    externalPostId: post.externalPostId,
    attempts: typeof publication.attempts === "number" ? publication.attempts : null,
    lastErrorCode: typeof publication.lastErrorCode === "string" ? publication.lastErrorCode : null,
    lastErrorMessage: typeof publication.lastErrorMessage === "string" ? publication.lastErrorMessage : null,
  };
}

function toConnectionSnapshot(account: SaasSocialAccount): SocialFlowOperatorConnectionSnapshot {
  return {
    id: account.id,
    provider: account.provider,
    handle: account.handle,
    displayName: account.displayName,
    status: account.status,
    isPrimary: account.isPrimary,
    updatedAt: account.updatedAt,
  };
}

function initStatusCounts(): Record<SaasSocialPostStatus, number> {
  return POST_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<SaasSocialPostStatus, number>);
}

function deriveSchedulerStatus(input: {
  publishingPosts: number;
  stalePublishingPosts: number;
  dueScheduledPosts: number;
}): "idle" | "active" | "needs_attention" {
  if (input.stalePublishingPosts > 0) return "needs_attention";
  if (input.publishingPosts > 0 || input.dueScheduledPosts > 0) return "active";
  return "idle";
}

function deriveHealthStatus(input: {
  observabilitySummary: ObservabilityStatusSummary;
  schedulerStatus: "idle" | "active" | "needs_attention";
  failedLast30Days: number;
}): SocialFlowOperatorObservability["health"]["status"] {
  if (input.schedulerStatus === "needs_attention") return "needs_attention";
  if (input.observabilitySummary.overallStatus !== "unknown") return input.observabilitySummary.overallStatus;
  if (input.failedLast30Days > 0) return "needs_attention";
  return "healthy";
}

// P5: los eventos de publicación se escriben ahora en SOCIAL_DB (socialflow_publish_activity).
// Se combinan con los de observability-core (DRACO_DB), que conserva el histórico y otros
// orígenes, para que el panel del operator no pierda la actividad reciente.
function toObservabilityActivity(activity: PublishActivity): ObservabilityActivity {
  return {
    id: activity.id,
    tenantId: activity.tenantId,
    saasId: activity.saasId,
    sourceType: "integration",
    sourceKey: `post:${activity.postId}`,
    activityType: activity.activityType,
    status: activity.status,
    summary: activity.summary,
    metadata: activity.metadata,
    createdAt: activity.createdAt,
  };
}

async function listRecentActivities(
  socialDb: D1Database | null | undefined,
  tenantId: string,
  saasId: string,
  limit = 10,
): Promise<ObservabilityActivity[]> {
  const [legacy, publish] = await Promise.all([
    listObservabilityActivities({ tenantId, saasId, limit }).catch((): ObservabilityActivity[] => []),
    socialDb
      ? listPublishActivities(socialDb, { tenantId, saasId, limit }).catch((): PublishActivity[] => [])
      : Promise.resolve<PublishActivity[]>([]),
  ]);
  return [...legacy, ...publish.map(toObservabilityActivity)]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function getSocialFlowOperatorObservability(input: {
  tenantId: string;
  saasId: string;
}): Promise<SocialFlowOperatorObservability> {
  const tenantId = input.tenantId.trim();
  const saasId = input.saasId.trim();
  if (!tenantId) throw new Error("SOCIALFLOW_OBSERVABILITY_TENANT_REQUIRED");
  if (!saasId) throw new Error("SOCIALFLOW_OBSERVABILITY_SAAS_REQUIRED");

  const ctx = await resolveSocialContext({ tenantId, saasId });
  const [posts, accounts, analytics, observabilitySummary, recentEvents, recentIncidents] = await Promise.all([
    listSaasSocialPosts(ctx),
    listSaasSocialAccounts(ctx),
    getSocialAnalyticsSnapshot(ctx),
    getObservabilityStatusSummary({ tenantId, saasId }).catch((): ObservabilityStatusSummary => ({
      tenantId,
      saasId,
      overallStatus: "unknown",
      freshnessStatus: "unknown",
      openIncidentsCount: 0,
      latestActivityAt: null,
      latestSnapshotAt: null,
      recommendation: "Observability core has no snapshot for this SocialFlow workspace yet.",
    })),
    listRecentActivities(ctx.socialDb, tenantId, saasId),
    listObservabilityIncidents({ tenantId, saasId, status: "OPEN", limit: 10 }).catch(() => []),
  ]);

  const now = Date.now();
  const byStatus = initStatusCounts();
  for (const post of posts) {
    byStatus[post.status] = (byStatus[post.status] ?? 0) + 1;
  }

  const scheduledPosts = posts.filter((post) => post.status === "SCHEDULED");
  const dueScheduledPosts = scheduledPosts.filter((post) => post.scheduledAt && Date.parse(post.scheduledAt) <= now);
  const publishingPosts = posts.filter((post) => post.status === "PUBLISHING");
  const stalePublishing = publishingPosts.filter((post) => isStalePublishing(post, now));
  const publishedLast30Days = posts.filter((post) => (post.status === "POSTED" || post.status === "PUBLISHED") && isWithinLast30Days(post, now));
  const failedLast30Days = posts.filter((post) => post.status === "FAILED" && isWithinLast30Days(post, now));
  const totalPublishOutcomes = publishedLast30Days.length + failedLast30Days.length;
  const schedulerStatus = deriveSchedulerStatus({
    publishingPosts: publishingPosts.length,
    stalePublishingPosts: stalePublishing.length,
    dueScheduledPosts: dueScheduledPosts.length,
  });
  const linkedInAccounts = accounts.filter((account) => account.provider === "LINKEDIN");
  const primaryLinkedIn = linkedInAccounts.find((account) => account.isPrimary) ?? linkedInAccounts[0] ?? null;

  return {
    tenantId,
    saasId,
    capturedAt: new Date(now).toISOString(),
    health: {
      status: deriveHealthStatus({
        observabilitySummary,
        schedulerStatus,
        failedLast30Days: failedLast30Days.length,
      }),
      freshnessStatus: observabilitySummary.freshnessStatus,
      schedulerStatus,
      recommendation: stalePublishing.length > 0
        ? `Recover ${stalePublishing.length} post(s) stuck in PUBLISHING.`
        : observabilitySummary.recommendation,
      openIncidentsCount: recentIncidents.length || observabilitySummary.openIncidentsCount,
      latestActivityAt: recentEvents[0]?.createdAt ?? observabilitySummary.latestActivityAt,
      latestSnapshotAt: observabilitySummary.latestSnapshotAt,
    },
    scheduler: {
      scheduledPosts: scheduledPosts.length,
      dueScheduledPosts: dueScheduledPosts.length,
      publishingPosts: publishingPosts.length,
      stalePublishingPosts: stalePublishing.length,
      nextScheduledAt: scheduledPosts
        .map((post) => post.scheduledAt)
        .filter((value): value is string => Boolean(value))
        .sort()[0] ?? null,
      lastPublishedAt: posts
        .filter((post) => post.status === "POSTED" || post.status === "PUBLISHED")
        .map((post) => post.postedAt ?? post.updatedAt)
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
    },
    posts: {
      total: posts.length,
      byStatus,
      recentPublished: publishedLast30Days
        .sort((a, b) => getPostTime(b) - getPostTime(a))
        .slice(0, 5)
        .map(toPostSnapshot),
      recentFailed: failedLast30Days
        .sort((a, b) => getPostTime(b) - getPostTime(a))
        .slice(0, 5)
        .map(toPostSnapshot),
      stalePublishing: stalePublishing
        .sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))
        .slice(0, 5)
        .map(toPostSnapshot),
    },
    publishing: {
      successLast30Days: publishedLast30Days.length,
      failedLast30Days: failedLast30Days.length,
      successRateLast30Days: totalPublishOutcomes > 0 ? publishedLast30Days.length / totalPublishOutcomes : 0,
      lastFailureAt: failedLast30Days
        .map((post) => post.updatedAt)
        .sort((a, b) => b.localeCompare(a))[0] ?? null,
    },
    linkedin: {
      connected: Boolean(primaryLinkedIn && primaryLinkedIn.status === "CONNECTED_REAL"),
      totalConnections: linkedInAccounts.length,
      primaryStatus: primaryLinkedIn?.status ?? null,
      connections: linkedInAccounts.map(toConnectionSnapshot),
    },
    metrics: {
      last7Days: {
        engagement: analytics.last7Days.engagement,
        publishedPosts: analytics.last7Days.publishedPosts,
        topProvider: analytics.last7Days.topProvider,
      },
      last30Days: {
        engagement: analytics.last30Days.engagement,
        publishedPosts: analytics.last30Days.publishedPosts,
        topProvider: analytics.last30Days.topProvider,
      },
    },
    recentEvents,
    recentIncidents,
  };
}
