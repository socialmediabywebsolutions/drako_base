import {
  approveRuntimePostInDb,
  getRuntimePostByIdFromDb,
  listRuntimePostsFromDb,
  markRuntimePostAsPostedInDb,
  runRuntimeSocialSchedulerSimulation,
  scheduleRuntimePostInDb,
  SocialContextError,
  upsertRuntimePostInDb,
  rejectRuntimePostInDb,
} from "./posts-repository";
import { publishRuntimePostLive as publishRuntimePostLiveInDb } from "./live-publishing-service";

export { SocialContextError };

export async function listRuntimePosts(params: {
  tenantId: string;
  saasId: string;
  filters?: { campaignId?: string | null; status?: string | null; provider?: "LINKEDIN" | null };
}) {
  await runRuntimeSocialSchedulerSimulation();
  return listRuntimePostsFromDb(params);
}

export async function getRuntimePostById(params: { tenantId: string; saasId: string; postId: string }) {
  return getRuntimePostByIdFromDb(params);
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
  return upsertRuntimePostInDb({
    tenantId: params.tenantId,
    post: {
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
    },
  });
}

export async function publishRuntimePostLive(params: { tenantId: string; saasId: string; postId: string }) {
  return publishRuntimePostLiveInDb({
    tenantId: params.tenantId,
    saasId: params.saasId,
    postId: params.postId,
    skipClaim: true,
  });
}

export async function approveRuntimePost(params: { tenantId: string; saasId: string; postId: string }) {
  return approveRuntimePostInDb(params);
}

export async function rejectRuntimePost(params: { tenantId: string; saasId: string; postId: string }) {
  return rejectRuntimePostInDb(params);
}

export async function scheduleRuntimePost(params: {
  tenantId: string;
  saasId: string;
  postId: string;
  scheduledAt: string | null;
}) {
  return scheduleRuntimePostInDb(params);
}

export async function markRuntimePostAsPosted(params: {
  tenantId: string;
  saasId: string;
  postId: string;
  externalPostId: string | null;
  postedAt: string | null;
}) {
  return markRuntimePostAsPostedInDb({
    tenantId: params.tenantId,
    saasId: params.saasId,
    postId: params.postId,
    externalPostId: params.externalPostId,
    postedAt: params.postedAt,
  });
}
