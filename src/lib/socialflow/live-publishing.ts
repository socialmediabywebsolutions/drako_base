import { LinkedInIntegrationError } from "@/lib/socialflow/linkedin/core";
import { publishPost } from "@/lib/socialflow/linkedin/publishing";
import {
  InstagramPublishingError,
  publishInstagramContent,
  requireInstagramCredentials,
  type InstagramPostContentType,
} from "@/lib/socialflow/meta/publishing";
import { claimScheduledPostForPublishing, getSaasSocialPostById, listSaasSocialAccounts, markAsPosted, updateSaasSocialPostStatus, upsertSaasSocialPost } from "@/lib/socialflow/repository";
import type { SocialContext } from "@/lib/socialflow/repository";
import type { SaasSocialAccount, SaasSocialContentType, SaasSocialPost, SaasSocialProvider } from "@/lib/social-core/types";
import { recordObservabilityActivity } from "@/lib/observability-core";

const LIVE_PUBLISH_MAX_ATTEMPTS = 3;
const LIVE_PUBLISH_BASE_DELAY_MS = 1000;
const LIVE_PUBLISH_MAX_DELAY_MS = 5000;

const SUPPORTED_PROVIDERS = new Set<SaasSocialProvider>(["LINKEDIN", "INSTAGRAM"]);

async function findPrimaryLinkedInAccount(ctx: SocialContext) {
  const accounts = await listSaasSocialAccounts(ctx);
  return accounts.find((account) => account.provider === "LINKEDIN" && account.isPrimary) ?? null;
}

async function findPrimaryInstagramAccount(ctx: SocialContext) {
  const accounts = await listSaasSocialAccounts(ctx);
  return (
    accounts.find((a) => a.provider === "INSTAGRAM" && a.isPrimary && a.status === "CONNECTED_REAL") ??
    accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL") ??
    null
  );
}

async function publishToLinkedIn(input: {
  account: SaasSocialAccount;
  post: SaasSocialPost;
}): Promise<{ externalPostId?: string | null }> {
  const operation = await publishPost(
    input.account,
    input.post.body?.trim() || input.post.title,
  );
  return { externalPostId: operation.externalPostId };
}

function mapToInstagramContentType(ct: SaasSocialContentType): InstagramPostContentType {
  if (ct === "REEL" || ct === "SHORT" || ct === "STORY") return ct;
  return "FEED"; // FEED, CAROUSEL, unknown → image feed post
}

async function publishToInstagram(input: {
  account: SaasSocialAccount;
  post: SaasSocialPost;
}): Promise<{ externalPostId?: string | null }> {
  const creds = await requireInstagramCredentials(input.account);
  const caption = input.post.body?.trim() || input.post.title;
  const mediaUrl = input.post.imageHint?.trim() ?? "";

  if (!mediaUrl.startsWith("http")) {
    throw new InstagramPublishingError(
      "A public HTTPS media URL is required. Set the imageHint field on the post.",
      { code: "INSTAGRAM_MEDIA_REQUIRED" },
    );
  }

  const contentType = mapToInstagramContentType(input.post.contentType);
  const result = await publishInstagramContent({
    accessToken: creds.accessToken,
    igUserId: creds.igUserId,
    apiBase: creds.apiBase,
    caption,
    contentType,
    mediaUrl,
  });
  return { externalPostId: result.externalPostId };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attemptNumber: number): number {
  return Math.min(LIVE_PUBLISH_MAX_DELAY_MS, LIVE_PUBLISH_BASE_DELAY_MS * (2 ** Math.max(0, attemptNumber - 1)));
}

function getPublicationMetadata(post: SaasSocialPost): Record<string, unknown> {
  return typeof post.metadata?.publication === "object" && post.metadata.publication
    ? (post.metadata.publication as Record<string, unknown>)
    : {};
}

async function persistPublicationState(
  ctx: SocialContext,
  post: SaasSocialPost,
  patch: Record<string, unknown>,
): Promise<SaasSocialPost | null> {
  return upsertSaasSocialPost(ctx, {
    id: post.id,
    saasId: post.saasId,
    channelId: post.channelId ?? null,
    campaignId: post.campaignId,
    provider: post.provider,
    contentType: post.contentType,
    title: post.title,
    body: post.body,
    imageHint: post.imageHint,
    status: post.status,
    scheduledAt: post.scheduledAt,
    postedAt: post.postedAt,
    externalPostId: post.externalPostId,
    metadata: {
      ...(post.metadata ?? {}),
      publication: {
        ...getPublicationMetadata(post),
        ...patch,
      },
    },
  });
}

function getProviderErrorCode(error: unknown): string {
  if (error instanceof LinkedInIntegrationError) return error.code;
  if (error instanceof InstagramPublishingError) return error.code;
  return "PUBLISH_FAILED";
}

function isRetryablePublishError(error: unknown): boolean {
  if (error instanceof LinkedInIntegrationError) {
    const status = typeof error.details?.status === "number" ? error.details.status : null;
    return error.code === "LINKEDIN_PUBLISH_RATE_LIMITED"
      || error.code === "LINKEDIN_PUBLISH_FAILED"
      || status === 429
      || (status !== null && status >= 500);
  }
  if (error instanceof InstagramPublishingError) {
    const status = typeof error.details?.status === "number" ? error.details.status : null;
    return error.code === "INSTAGRAM_PUBLISH_RATE_LIMITED"
      || error.code === "INSTAGRAM_PUBLISH_FAILED"
      || status === 429
      || (status !== null && status >= 500);
  }
  return error instanceof Error;
}

function safeRecordActivity(ctx: SocialContext, postId: string, activityType: string, status: "success" | "error" | "info", summary: string, metadata?: Record<string, unknown>) {
  if (!ctx.saasId) return;
  try {
    recordObservabilityActivity({
      tenantId: ctx.tenantId,
      saasId: ctx.saasId,
      sourceType: "integration",
      sourceKey: `post:${postId}`,
      activityType,
      status,
      summary,
      metadata,
    }).catch(() => {});
  } catch { /* observability must never break publishing */ }
}

export async function publishSocialPostLive(
  ctx: SocialContext,
  postId: string,
  options?: { skipClaim?: boolean },
): Promise<{ ok: boolean; code?: string; message?: string; externalPostId?: string | null; post: SaasSocialPost | null }> {
  const startedAt = Date.now();
  try {
    let post = await getSaasSocialPostById(ctx, postId);

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
      console.warn(`[SocialFlow] Post ${postId} has externalPostId but status=${post.status}. Marking as posted (idempotency recovery).`);
      safeRecordActivity(ctx, postId, "publish_idempotency_recovery", "info", `Post had externalPostId=${post.externalPostId} with status=${post.status}. Recovering.`);
      const recovered = await markAsPosted(ctx, { id: postId, externalPostId: post.externalPostId, postedAt: post.postedAt });
      return { ok: true, code: "IDEMPOTENCY_RECOVERED", message: "Post was already published externally. Status recovered.", externalPostId: post.externalPostId, post: recovered };
    }

    if (!options?.skipClaim && post.status === "SCHEDULED") {
      const claimed = await claimScheduledPostForPublishing(ctx, postId);
      if (!claimed) {
        return { ok: false, code: "CLAIM_FAILED", message: "Post is already being published by another process.", post };
      }
      post = (await getSaasSocialPostById(ctx, postId)) ?? post;
    }

    console.log(`[SocialFlow] Live publish started for post ${postId} (Provider: ${post.provider})`);
    safeRecordActivity(ctx, postId, "publish_started", "info", `Live publish started for ${post.provider} post.`, { provider: post.provider });

    if (!SUPPORTED_PROVIDERS.has(post.provider)) {
      console.error(`[SocialFlow] Unsupported provider for live publishing: ${post.provider}`);
      post = (await persistPublicationState(ctx, post, {
        mode: "live",
        state: "failed",
        attempts: 1,
        maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
        lastAttemptAt: new Date().toISOString(),
        lastErrorCode: "UNSUPPORTED_PROVIDER",
        lastErrorMessage: `Provider ${post.provider} is not supported for live publishing.`,
        nextRetryAt: null,
      })) ?? post;
      await updateSaasSocialPostStatus(ctx, { id: postId, status: "FAILED" });
      safeRecordActivity(ctx, postId, "publish_failed", "error", `Unsupported provider: ${post.provider}`, { errorCode: "UNSUPPORTED_PROVIDER" });
      return {
        ok: false,
        code: "UNSUPPORTED_PROVIDER",
        message: `Provider ${post.provider} is not supported for live publishing`,
        externalPostId: null,
        post: await getSaasSocialPostById(ctx, postId),
      };
    }

    const account = post.provider === "INSTAGRAM"
      ? await findPrimaryInstagramAccount(ctx)
      : await findPrimaryLinkedInAccount(ctx);

    const accountMissingCode = post.provider === "INSTAGRAM"
      ? "INSTAGRAM_ACCOUNT_MISSING"
      : "LINKEDIN_ACCOUNT_MISSING";
    const accountMissingMessage = post.provider === "INSTAGRAM"
      ? "No connected Instagram account found for this workspace."
      : "No primary LinkedIn account configured for this workspace.";

    if (!account) {
      console.error(`[SocialFlow] No ${post.provider} account found for live publishing.`);
      post = (await persistPublicationState(ctx, post, {
        mode: "live",
        state: "failed",
        attempts: 1,
        maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
        lastAttemptAt: new Date().toISOString(),
        lastErrorCode: accountMissingCode,
        lastErrorMessage: accountMissingMessage,
        nextRetryAt: null,
      })) ?? post;
      await updateSaasSocialPostStatus(ctx, { id: postId, status: "FAILED" });
      safeRecordActivity(ctx, postId, "publish_failed", "error", accountMissingMessage, { errorCode: accountMissingCode });
      return {
        ok: false,
        code: accountMissingCode,
        message: accountMissingMessage,
        externalPostId: null,
        post: await getSaasSocialPostById(ctx, postId),
      };
    }

    let externalPostId: string | null | undefined = null;

    for (let attempt = 1; attempt <= LIVE_PUBLISH_MAX_ATTEMPTS; attempt += 1) {
      const attemptedAt = new Date().toISOString();
      try {
        post = (await persistPublicationState(ctx, post, {
          mode: "live",
          state: attempt === 1 ? "publishing" : "retrying",
          attempts: attempt,
          maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
          lastAttemptAt: attemptedAt,
          lastErrorCode: null,
          lastErrorMessage: null,
          nextRetryAt: null,
        })) ?? post;

        const result: { externalPostId?: string | null } = post.provider === "INSTAGRAM"
          ? await publishToInstagram({ account, post })
          : await publishToLinkedIn({ account, post });
        externalPostId = result.externalPostId ?? null;
        post = (await persistPublicationState(ctx, post, {
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
      } catch (providerError) {
        const canRetry = isRetryablePublishError(providerError) && attempt < LIVE_PUBLISH_MAX_ATTEMPTS;
        const retryDelayMs = canRetry ? getRetryDelayMs(attempt) : null;
        const nextRetryAt = retryDelayMs != null ? new Date(Date.now() + retryDelayMs).toISOString() : null;
        const errorCode = getProviderErrorCode(providerError);
        const errorMessage: string = providerError instanceof Error ? providerError.message : `${post.provider} publish failed`;

        console.error(`[SocialFlow] ${post.provider} publish failed for post ${postId} on attempt ${attempt}`, providerError);
        safeRecordActivity(ctx, postId, "publish_attempt_failed", "error", `Attempt ${attempt}/${LIVE_PUBLISH_MAX_ATTEMPTS} failed: ${errorCode}`, { attempt, errorCode, errorMessage, canRetry });

        post = (await persistPublicationState(ctx, post, {
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
          await updateSaasSocialPostStatus(ctx, { id: postId, status: "FAILED" });
          safeRecordActivity(ctx, postId, "publish_failed", "error", `All ${LIVE_PUBLISH_MAX_ATTEMPTS} attempts exhausted. Final error: ${errorCode}`, { attempts: attempt, errorCode, durationMs: Date.now() - startedAt });
          return {
            ok: false,
            code: errorCode,
            message: errorMessage,
            externalPostId: null,
            post: await getSaasSocialPostById(ctx, postId),
          };
        }

        if (retryDelayMs == null) {
          throw new Error("Retry delay was not resolved for a retryable publish error.");
        }

        await delay(retryDelayMs);
        const refreshedPost = await getSaasSocialPostById(ctx, postId);
        if (refreshedPost) {
          if (refreshedPost.status === "POSTED" || refreshedPost.status === "PUBLISHED") {
            return { ok: true, code: "ALREADY_PUBLISHED", message: "Post was published by another process during retry.", externalPostId: refreshedPost.externalPostId, post: refreshedPost };
          }
          post = refreshedPost;
        }
      }
    }

    const updatedPost = await markAsPosted(ctx, {
      id: postId,
      externalPostId,
      postedAt: new Date().toISOString(),
    });

    const durationMs = Date.now() - startedAt;
    console.log(`[SocialFlow] Live publish succeeded for post ${postId} via ${post.provider} (externalPostId=${externalPostId ?? "null"}, ${durationMs}ms)`);
    safeRecordActivity(ctx, postId, "publish_succeeded", "success", `Post published to ${post.provider} in ${durationMs}ms.`, { externalPostId, durationMs, provider: post.provider });

    return {
      ok: true,
      code: `PUBLISHED_LIVE_${post.provider}`,
      message: `Post published successfully to ${post.provider === "INSTAGRAM" ? "Instagram" : "LinkedIn"}`,
      externalPostId,
      post: updatedPost,
    };

  } catch (error) {
    console.error(`[SocialFlow] Failed to publish post ${postId}`, error);
    safeRecordActivity(ctx, postId, "publish_crashed", "error", `Unexpected error: ${error instanceof Error ? error.message : String(error)}`, { durationMs: Date.now() - startedAt });

    try {
      await updateSaasSocialPostStatus(ctx, { id: postId, status: "FAILED" });
    } catch (e) {
      console.error(`[SocialFlow] Failed to update post status to FAILED for ${postId}`, e);
    }

    return {
      ok: false,
      code: "PUBLISH_FAILED",
      message: error instanceof Error ? error.message : "Unknown error during publishing",
      externalPostId: null,
      post: await getSaasSocialPostById(ctx, postId),
    };
  }
}
