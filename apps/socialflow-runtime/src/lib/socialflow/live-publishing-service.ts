import { LinkedInIntegrationError } from "@/lib/socialflow/linkedin/core";
import {
  findPrimaryRuntimeLinkedInAccount,
  getRuntimePostByIdFromDb,
  markRuntimePostAsPostedInDb,
  updateRuntimePostStatusInDb,
  upsertRuntimePostInDb,
  claimRuntimeScheduledPostForPublishing,
  SocialContextError,
} from "./posts-repository";
import type { RuntimeSocialPost } from "./contracts";
import { buildRuntimeLinkedInPublishResult } from "./linkedin-service";
import { mergeJsonRecord, nowIso } from "./runtime-repository-core";

const LIVE_PUBLISH_MAX_ATTEMPTS = 3;
const LIVE_PUBLISH_BASE_DELAY_MS = 1000;
const LIVE_PUBLISH_MAX_DELAY_MS = 5000;

function publicationMetadata(post: RuntimeSocialPost) {
  return typeof post.metadata?.publication === "object" && post.metadata.publication
    ? post.metadata.publication as Record<string, unknown>
    : {};
}

function getRetryDelayMs(attemptNumber: number) {
  return Math.min(LIVE_PUBLISH_MAX_DELAY_MS, LIVE_PUBLISH_BASE_DELAY_MS * (2 ** Math.max(0, attemptNumber - 1)));
}

function isRetryablePublishError(error: unknown) {
  if (error instanceof LinkedInIntegrationError) {
    const status = typeof error.details?.status === "number" ? error.details.status : null;
    return error.code === "LINKEDIN_PUBLISH_RATE_LIMITED"
      || error.code === "LINKEDIN_PUBLISH_FAILED"
      || status === 429
      || (status !== null && status >= 500);
  }
  return error instanceof Error;
}

function getProviderErrorCode(error: unknown) {
  return error instanceof LinkedInIntegrationError ? error.code : "LINKEDIN_PUBLISH_FAILED";
}

async function persistPublicationState(
  tenantId: string,
  post: RuntimeSocialPost,
  patch: Record<string, unknown>,
) {
  return upsertRuntimePostInDb({
    tenantId,
    post: {
      id: post.id,
      saasId: post.saasId,
      campaignId: post.campaignId,
      channelId: post.channelId,
      provider: post.provider,
      contentType: post.contentType,
      title: post.title,
      body: post.body,
      imageHint: post.imageHint,
      status: post.status,
      scheduledAt: post.scheduledAt,
      postedAt: post.postedAt,
      externalPostId: post.externalPostId,
      metadata: mergeJsonRecord(post.metadata, {
        publication: {
          ...publicationMetadata(post),
          ...patch,
        },
      }),
    },
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { SocialContextError };

export async function publishRuntimePostLive(params: {
  tenantId: string;
  saasId: string;
  postId: string;
  skipClaim?: boolean;
}) {
  let post = await getRuntimePostByIdFromDb(params);
  if (!post) {
    return { ok: false, code: "POST_NOT_FOUND", message: "Post not found", post: null };
  }

  if (post.status === "POSTED" || post.status === "PUBLISHED") {
    return {
      ok: true,
      code: "ALREADY_PUBLISHED",
      message: "Post is already published.",
      externalPostId: post.externalPostId,
      post,
    };
  }

  if (post.externalPostId) {
    const recovered = await markRuntimePostAsPostedInDb({
      tenantId: params.tenantId,
      saasId: params.saasId,
      postId: params.postId,
      externalPostId: post.externalPostId,
      postedAt: post.postedAt,
    });
    return {
      ok: true,
      code: "IDEMPOTENCY_RECOVERED",
      message: "Post was already published externally. Status recovered.",
      externalPostId: post.externalPostId,
      post: recovered,
    };
  }

  if (!params.skipClaim && post.status === "SCHEDULED") {
    const claimed = await claimRuntimeScheduledPostForPublishing(params);
    if (!claimed) {
      return {
        ok: false,
        code: "CLAIM_FAILED",
        message: "Post is already being published by another process.",
        post,
      };
    }
    post = (await getRuntimePostByIdFromDb(params)) ?? post;
  }

  if (post.provider !== "LINKEDIN") {
    post = (await persistPublicationState(params.tenantId, post, {
      mode: "live",
      state: "failed",
      attempts: 1,
      maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
      lastAttemptAt: nowIso(),
      lastErrorCode: "UNSUPPORTED_PROVIDER",
      lastErrorMessage: `Provider ${post.provider} is not supported for live publishing.`,
      nextRetryAt: null,
    })) ?? post;
    await updateRuntimePostStatusInDb({
      tenantId: params.tenantId,
      saasId: params.saasId,
      postId: params.postId,
      status: "FAILED",
    });
    return {
      ok: false,
      code: "UNSUPPORTED_PROVIDER",
      message: `Provider ${post.provider} is not supported for live publishing`,
      externalPostId: null,
      post: await getRuntimePostByIdFromDb(params),
    };
  }

  const account = await findPrimaryRuntimeLinkedInAccount(params);
  if (!account) {
    post = (await persistPublicationState(params.tenantId, post, {
      mode: "live",
      state: "failed",
      attempts: 1,
      maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
      lastAttemptAt: nowIso(),
      lastErrorCode: "LINKEDIN_ACCOUNT_MISSING",
      lastErrorMessage: "No primary LinkedIn account configured for this workspace.",
      nextRetryAt: null,
    })) ?? post;
    await updateRuntimePostStatusInDb({
      tenantId: params.tenantId,
      saasId: params.saasId,
      postId: params.postId,
      status: "FAILED",
    });
    return {
      ok: false,
      code: "LINKEDIN_ACCOUNT_MISSING",
      message: "No primary LinkedIn account configured for this workspace.",
      externalPostId: null,
      post: await getRuntimePostByIdFromDb(params),
    };
  }

  let externalPostId: string | null | undefined = null;

  for (let attempt = 1; attempt <= LIVE_PUBLISH_MAX_ATTEMPTS; attempt += 1) {
    const attemptedAt = nowIso();

    try {
      post = (await persistPublicationState(params.tenantId, post, {
        mode: "live",
        state: attempt === 1 ? "publishing" : "retrying",
        attempts: attempt,
        maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
        lastAttemptAt: attemptedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextRetryAt: null,
      })) ?? post;

      const result = await buildRuntimeLinkedInPublishResult(account, post.body?.trim() || post.title);
      externalPostId = result.externalPostId ?? null;
      post = (await persistPublicationState(params.tenantId, post, {
        mode: "live",
        state: "published",
        attempts: attempt,
        maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
        lastAttemptAt: attemptedAt,
        lastErrorCode: null,
        lastErrorMessage: null,
        nextRetryAt: null,
        externalPostId,
      })) ?? post;
      break;
    } catch (error) {
      const canRetry = isRetryablePublishError(error) && attempt < LIVE_PUBLISH_MAX_ATTEMPTS;
      const retryDelayMs = canRetry ? getRetryDelayMs(attempt) : null;
      const nextRetryAt = retryDelayMs != null ? new Date(Date.now() + retryDelayMs).toISOString() : null;
      const errorCode = getProviderErrorCode(error);
      const errorMessage = error instanceof Error ? error.message : "LinkedIn publish failed";

      post = (await persistPublicationState(params.tenantId, post, {
        mode: "live",
        state: canRetry ? "retry_scheduled" : "failed",
        attempts: attempt,
        maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
        lastAttemptAt: attemptedAt,
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
        nextRetryAt,
      })) ?? post;

      if (!canRetry) {
        await updateRuntimePostStatusInDb({
          tenantId: params.tenantId,
          saasId: params.saasId,
          postId: params.postId,
          status: "FAILED",
        });
        return {
          ok: false,
          code: errorCode,
          message: errorMessage,
          externalPostId: null,
          post: await getRuntimePostByIdFromDb(params),
        };
      }

      await delay(retryDelayMs ?? LIVE_PUBLISH_BASE_DELAY_MS);
      post = (await getRuntimePostByIdFromDb(params)) ?? post;
    }
  }

  const published = await markRuntimePostAsPostedInDb({
    tenantId: params.tenantId,
    saasId: params.saasId,
    postId: params.postId,
    externalPostId: externalPostId ?? null,
    postedAt: nowIso(),
  });

  return {
    ok: true,
    code: "PUBLISHED_LIVE_LINKEDIN",
    message: "Post published live.",
    externalPostId: externalPostId ?? null,
    post: published,
  };
}
