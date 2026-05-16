import {
  approvePost,
  getSaasSocialPostById,
  listSaasSocialPosts,
  markAsPosted,
  rejectPost,
  resolveSocialContext,
  runSocialSchedulerSimulation,
  schedulePost,
  SocialContextError,
  upsertSaasSocialPost,
} from "@/lib/socialflow/repository";
import { publishSocialPostLive } from "@/lib/socialflow/live-publishing";

export { SocialContextError };

export async function listRuntimePosts(params: {
  tenantId: string;
  saasId: string;
  filters?: { campaignId?: string | null; status?: string | null; provider?: "LINKEDIN" | null };
}) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  await runSocialSchedulerSimulation(context);
  return listSaasSocialPosts(context, params.filters);
}

export async function getRuntimePostById(params: { tenantId: string; saasId: string; postId: string }) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  return getSaasSocialPostById(context, params.postId);
}

export async function saveRuntimePost(params: {
  tenantId: string;
  saasId: string;
  post: {
    id?: string;
    campaignId?: string | null;
    channelId?: string | null;
    provider: "LINKEDIN";
    contentType: string;
    title: string;
    body: string;
    imageHint?: string | null;
    status: string;
    scheduledAt?: string | null;
    postedAt?: string | null;
    externalPostId?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  return upsertSaasSocialPost(context, {
    id: params.post.id,
    saasId: params.saasId,
    campaignId: params.post.campaignId ?? null,
    channelId: params.post.channelId ?? null,
    provider: params.post.provider,
    contentType: params.post.contentType as any,
    title: params.post.title,
    body: params.post.body,
    imageHint: params.post.imageHint ?? null,
    status: params.post.status as any,
    scheduledAt: params.post.scheduledAt ?? null,
    postedAt: params.post.postedAt ?? null,
    externalPostId: params.post.externalPostId ?? null,
    metadata: params.post.metadata ?? null,
  });
}

export async function publishRuntimePostLive(params: { tenantId: string; saasId: string; postId: string }) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  return publishSocialPostLive(context, params.postId, { skipClaim: true });
}

export async function approveRuntimePost(params: { tenantId: string; saasId: string; postId: string }) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });
  return approvePost(context, params.postId);
}

export async function rejectRuntimePost(params: { tenantId: string; saasId: string; postId: string }) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });
  return rejectPost(context, params.postId);
}

export async function scheduleRuntimePost(params: {
  tenantId: string;
  saasId: string;
  postId: string;
  scheduledAt: string | null;
}) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });
  return schedulePost(context, { id: params.postId, scheduledAt: params.scheduledAt });
}

export async function markRuntimePostAsPosted(params: {
  tenantId: string;
  saasId: string;
  postId: string;
  externalPostId: string | null;
  postedAt: string | null;
}) {
  const context = await resolveSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  return markAsPosted(context, {
    id: params.postId,
    externalPostId: params.externalPostId,
    postedAt: params.postedAt,
  });
}
