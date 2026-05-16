import { queryAll, queryOne, run } from "../db/runtime-db";
import type { RuntimePostUpsertInput, RuntimeSocialAccount, RuntimeSocialPost, RuntimeSocialProvider } from "./contracts";
import {
  claimPublishingSlot,
  ensureRuntimeChannelForProvider,
  listRuntimeSocialAccounts,
  mapSocialPostRow,
  mergeJsonRecord,
  nowIso,
  parseJsonRecord,
  resolveRuntimeSocialContext,
  SocialContextError,
} from "./runtime-repository-core";
import { normalizeRuntimePostInput } from "./validators";

type SocialPostRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  channel_id: string | null;
  campaign_id: string | null;
  provider: string;
  content_type: string;
  title: string;
  body: string;
  image_hint: string | null;
  status: string;
  scheduled_at: string | null;
  posted_at: string | null;
  external_post_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
};

function generatePostId() {
  try {
    return `sf_post_${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2)}`;
  } catch {
    return `sf_post_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function publicationMetadata(post: RuntimeSocialPost) {
  return typeof post.metadata?.publication === "object" && post.metadata.publication
    ? post.metadata.publication as Record<string, unknown>
    : {};
}

export { SocialContextError };

export async function listRuntimePostsFromDb(params: {
  tenantId: string;
  saasId: string;
  filters?: { campaignId?: string | null; status?: string | null; provider?: RuntimeSocialProvider | null };
}) {
  const context = await resolveRuntimeSocialContext({
    tenantId: params.tenantId,
    saasId: params.saasId,
  });

  const clauses = ["tenant_id = ?", "saas_id = ?"];
  const values: unknown[] = [context.tenantId, context.saasId];
  if (params.filters?.campaignId) {
    clauses.push("campaign_id = ?");
    values.push(params.filters.campaignId);
  }
  if (params.filters?.status) {
    clauses.push("status = ?");
    values.push(params.filters.status);
  }
  if (params.filters?.provider) {
    clauses.push("provider = ?");
    values.push(params.filters.provider);
  }

  const rows = await queryAll<SocialPostRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, channel_id, campaign_id, provider, content_type, title, body, image_hint, status, scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at
     FROM saas_social_posts
     WHERE ${clauses.join(" AND ")}
     ORDER BY datetime(created_at) DESC`,
    ...values,
  );

  return rows.map(mapSocialPostRow);
}

export async function getRuntimePostByIdFromDb(params: { tenantId: string; saasId: string; postId: string }) {
  const context = await resolveRuntimeSocialContext(params);
  const row = await queryOne<SocialPostRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, channel_id, campaign_id, provider, content_type, title, body, image_hint, status, scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at
     FROM saas_social_posts
     WHERE id = ? AND tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    params.postId,
    context.tenantId,
    context.saasId,
  );
  return row ? mapSocialPostRow(row) : null;
}

export async function upsertRuntimePostInDb(params: { tenantId: string; post: RuntimePostUpsertInput }) {
  const input = normalizeRuntimePostInput(params.post);
  const context = await resolveRuntimeSocialContext({
    tenantId: params.tenantId,
    saasId: input.saasId,
  });

  if (!input.title || !input.body) {
    throw new SocialContextError("Post title and body are required.");
  }

  const id = input.id ?? generatePostId();
  const now = nowIso();
  const channelId = input.channelId ?? await ensureRuntimeChannelForProvider(context, input.provider);

  await run(
    context.socialDb,
    `INSERT INTO saas_social_posts (id, tenant_id, saas_id, channel_id, campaign_id, provider, content_type, title, body, image_hint, status, scheduled_at, posted_at, external_post_id, metadata, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       channel_id = excluded.channel_id,
       campaign_id = excluded.campaign_id,
       provider = excluded.provider,
       content_type = excluded.content_type,
       title = excluded.title,
       body = excluded.body,
       image_hint = excluded.image_hint,
       status = excluded.status,
       scheduled_at = excluded.scheduled_at,
       posted_at = excluded.posted_at,
       external_post_id = excluded.external_post_id,
       metadata = excluded.metadata,
       updated_at = excluded.updated_at`,
    id,
    context.tenantId,
    context.saasId,
    channelId,
    input.campaignId,
    input.provider,
    input.contentType,
    input.title,
    input.body,
    input.imageHint,
    input.status,
    input.scheduledAt,
    input.postedAt,
    input.externalPostId,
    input.metadata ? JSON.stringify(input.metadata) : null,
    now,
    now,
  );

  const stored = await getRuntimePostByIdFromDb({
    tenantId: context.tenantId,
    saasId: context.saasId,
    postId: id,
  });
  if (!stored) {
    throw new SocialContextError("Unable to persist post inside the SocialFlow runtime.");
  }
  return stored;
}

export async function updateRuntimePostStatusInDb(params: {
  tenantId: string;
  saasId: string;
  postId: string;
  status: RuntimeSocialPost["status"];
  postedAt?: string | null;
}) {
  const current = await getRuntimePostByIdFromDb(params);
  if (!current) {
    return null;
  }

  return upsertRuntimePostInDb({
    tenantId: params.tenantId,
    post: {
      id: current.id,
      saasId: current.saasId,
      campaignId: current.campaignId,
      channelId: current.channelId,
      provider: current.provider,
      contentType: current.contentType,
      title: current.title,
      body: current.body,
      imageHint: current.imageHint,
      status: params.status,
      scheduledAt: current.scheduledAt,
      postedAt: params.status === "POSTED" || params.status === "PUBLISHED" ? (params.postedAt ?? nowIso()) : current.postedAt,
      externalPostId: current.externalPostId,
      metadata: mergeJsonRecord(current.metadata, {
        publication: {
          ...publicationMetadata(current),
          state: params.status === "FAILED" ? "failed" : params.status === "POSTED" || params.status === "PUBLISHED" ? "published" : "queued",
          mode: params.status === "POSTED" || params.status === "PUBLISHED" ? "live" : publicationMetadata(current).mode ?? null,
          lastAttemptAt: nowIso(),
          externalPostId: current.externalPostId,
        },
      }),
    },
  });
}

export async function approveRuntimePostInDb(params: { tenantId: string; saasId: string; postId: string }) {
  const current = await getRuntimePostByIdFromDb(params);
  if (!current) return null;
  if (!["IDEA", "DRAFT", "IN_REVIEW"].includes(current.status)) {
    return current;
  }
  return updateRuntimePostStatusInDb({ ...params, status: "APPROVED" });
}

export async function rejectRuntimePostInDb(params: { tenantId: string; saasId: string; postId: string }) {
  const current = await getRuntimePostByIdFromDb(params);
  if (!current) return null;
  return updateRuntimePostStatusInDb({ ...params, status: "REJECTED" });
}

export async function scheduleRuntimePostInDb(params: { tenantId: string; saasId: string; postId: string; scheduledAt: string | null }) {
  const current = await getRuntimePostByIdFromDb(params);
  if (!current) return null;
  return upsertRuntimePostInDb({
    tenantId: params.tenantId,
    post: {
      id: current.id,
      saasId: current.saasId,
      campaignId: current.campaignId,
      channelId: current.channelId,
      provider: current.provider,
      contentType: current.contentType,
      title: current.title,
      body: current.body,
      imageHint: current.imageHint,
      status: "SCHEDULED",
      scheduledAt: params.scheduledAt,
      postedAt: current.postedAt,
      externalPostId: current.externalPostId,
      metadata: mergeJsonRecord(current.metadata, {
        publication: {
          ...publicationMetadata(current),
          state: "queued",
          lastAttemptAt: nowIso(),
        },
      }),
    },
  });
}

export async function markRuntimePostAsPostedInDb(params: {
  tenantId: string;
  saasId: string;
  postId: string;
  externalPostId?: string | null;
  postedAt?: string | null;
}) {
  const current = await getRuntimePostByIdFromDb(params);
  if (!current) return null;
  const nextExternalPostId = params.externalPostId ?? current.externalPostId ?? null;

  return upsertRuntimePostInDb({
    tenantId: params.tenantId,
    post: {
      id: current.id,
      saasId: current.saasId,
      campaignId: current.campaignId,
      channelId: current.channelId,
      provider: current.provider,
      contentType: current.contentType,
      title: current.title,
      body: current.body,
      imageHint: current.imageHint,
      status: "POSTED",
      scheduledAt: current.scheduledAt,
      postedAt: params.postedAt ?? nowIso(),
      externalPostId: nextExternalPostId,
      metadata: mergeJsonRecord(current.metadata, {
        publication: {
          ...publicationMetadata(current),
          state: "published",
          mode: "live",
          lastAttemptAt: nowIso(),
          externalPostId: nextExternalPostId,
        },
      }),
    },
  });
}

export async function claimRuntimeScheduledPostForPublishing(params: { tenantId: string; saasId: string; postId: string }) {
  const context = await resolveRuntimeSocialContext(params);
  return claimPublishingSlot(context, params.postId);
}

export async function listRuntimeSocialAccountsFromDb(params: { tenantId: string; saasId: string }) {
  const context = await resolveRuntimeSocialContext(params);
  return listRuntimeSocialAccounts(context);
}

export async function findPrimaryRuntimeLinkedInAccount(params: { tenantId: string; saasId: string }): Promise<RuntimeSocialAccount | null> {
  const accounts = await listRuntimeSocialAccountsFromDb(params);
  return accounts.find((account) => account.provider === "LINKEDIN" && account.isPrimary) ?? null;
}

export async function runRuntimeSocialSchedulerSimulation() {
  return { ok: true };
}
