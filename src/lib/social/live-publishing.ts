import { LinkedInIntegrationError } from "@/lib/social/linkedin";
import { publishPost } from "@/lib/social/linkedin-service";
import { getSaasSocialPostById, listSaasSocialAccounts, markAsPosted, updateSaasSocialPostStatus, upsertSaasSocialPost } from "@/lib/social/repository";
import type { SocialContext } from "@/lib/social/repository";
import type { SaasSocialPost, SaasSocialProvider } from "@/lib/social/types";

const LIVE_PUBLISH_MAX_ATTEMPTS = 3;
const LIVE_PUBLISH_BASE_DELAY_MS = 1000;
const LIVE_PUBLISH_MAX_DELAY_MS = 5000;

async function findPrimaryLinkedInAccount(ctx: SocialContext) {
  const accounts = await listSaasSocialAccounts(ctx);
  return accounts.find((account) => account.provider === "LINKEDIN" && account.isPrimary) ?? null;
}

async function publishToLinkedIn(input: {
  provider: SaasSocialProvider;
  account: Awaited<ReturnType<typeof findPrimaryLinkedInAccount>>;
  post: SaasSocialPost;
}): Promise<{ externalPostId?: string | null }> {
  if (input.provider !== "LINKEDIN") {
    throw new Error("UNSUPPORTED_PROVIDER_FOR_LIVE_PUBLISHING");
  }
  if (!input.account) {
    throw new Error("LINKEDIN_ACCOUNT_MISSING");
  }

  const operation = await publishPost(
    input.account,
    input.post.body?.trim() || input.post.title,
  );

  return {
    externalPostId: operation.externalPostId,
  };
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
  if (error instanceof LinkedInIntegrationError) {
    return error.code;
  }
  return "LINKEDIN_PUBLISH_FAILED";
}

function isRetryablePublishError(error: unknown): boolean {
  if (error instanceof LinkedInIntegrationError) {
    const status = typeof error.details?.status === "number" ? error.details.status : null;
    return error.code === "LINKEDIN_PUBLISH_RATE_LIMITED"
      || error.code === "LINKEDIN_PUBLISH_FAILED"
      || status === 429
      || (status !== null && status >= 500);
  }

  return error instanceof Error;
}

export async function publishSocialPostLive(
  ctx: SocialContext,
  postId: string,
): Promise<{ ok: boolean; code?: string; message?: string; externalPostId?: string | null; post: SaasSocialPost | null }> {
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

    console.log(`[SocialFlow] Live publish started for post ${postId} (Provider: ${post.provider})`);

    if (post.provider !== "LINKEDIN") {
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
      await updateSaasSocialPostStatus(ctx, {
        id: postId,
        status: "FAILED",
      });
      return {
        ok: false,
        code: "UNSUPPORTED_PROVIDER",
        message: `Provider ${post.provider} is not supported for live publishing`,
        externalPostId: null,
        post: await getSaasSocialPostById(ctx, postId),
      };
    }

    const account = await findPrimaryLinkedInAccount(ctx);
    if (!account) {
      console.error("[SocialFlow] No primary LinkedIn account configured for live publishing.");
      post = (await persistPublicationState(ctx, post, {
        mode: "live",
        state: "failed",
        attempts: 1,
        maxAttempts: LIVE_PUBLISH_MAX_ATTEMPTS,
        lastAttemptAt: new Date().toISOString(),
        lastErrorCode: "LINKEDIN_ACCOUNT_MISSING",
        lastErrorMessage: "No primary LinkedIn account configured for this workspace.",
        nextRetryAt: null,
      })) ?? post;
      await updateSaasSocialPostStatus(ctx, {
        id: postId,
        status: "FAILED",
      });
      return {
        ok: false,
        code: "LINKEDIN_ACCOUNT_MISSING",
        message: "No primary LinkedIn account configured for this workspace.",
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

        const result = await publishToLinkedIn({
          provider: post.provider,
          account,
          post,
        });
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
        const errorMessage = providerError instanceof Error ? providerError.message : "LinkedIn publish failed";

        console.error(`[SocialFlow] LinkedIn publish failed for post ${postId} on attempt ${attempt}`, providerError);

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
          await updateSaasSocialPostStatus(ctx, {
            id: postId,
            status: "FAILED",
          });

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
          post = refreshedPost;
        }
      }
    }

    const updatedPost = await markAsPosted(ctx, {
      id: postId,
      externalPostId,
      postedAt: new Date().toISOString(),
    });

    console.log(`[SocialFlow] Live publish succeeded for post ${postId} (externalPostId=${externalPostId ?? "null"})`);

    return {
      ok: true,
      code: "PUBLISHED_LIVE_LINKEDIN",
      message: "Post published successfully to LinkedIn",
      externalPostId,
      post: updatedPost,
    };

  } catch (error) {
    console.error(`[SocialFlow] Failed to publish post ${postId}`, error);

    try {
      await updateSaasSocialPostStatus(ctx, {
        id: postId,
        status: "FAILED",
      });
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
