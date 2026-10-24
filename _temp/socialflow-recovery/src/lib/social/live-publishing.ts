import {
  getSaasSocialPostById,
  listSaasSocialAccounts,
  type SocialContext,
  upsertSaasSocialAccount,
  upsertSaasSocialPost,
} from "@/lib/social/repository";
import { LinkedInIntegrationError, publishLinkedInTextPost } from "@/lib/social/linkedin";
import type { SaasSocialAccount, SaasSocialPost } from "@/lib/social/types";

function pickLinkedInAccount(accounts: SaasSocialAccount[], requestedAccountId?: string | null): SaasSocialAccount | null {
  const requested = requestedAccountId
    ? accounts.find((account) => account.id === requestedAccountId && account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL")
    : null;
  if (requested) return requested;
  return accounts.find((account) => account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL" && account.isPrimary)
    ?? accounts.find((account) => account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL")
    ?? null;
}

function mergePublicationMetadata(
  current: Record<string, unknown> | null,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const currentPublication = current?.publication;
  return {
    ...(current ?? {}),
    publication: {
      ...(typeof currentPublication === "object" && currentPublication !== null ? (currentPublication as Record<string, unknown>) : {}),
      ...patch,
    },
  };
}

export type LivePublishResult = {
  ok: boolean;
  post: SaasSocialPost | null;
  account: SaasSocialAccount | null;
  code?: string;
  message?: string;
};

export async function publishSocialPostLive(ctx: SocialContext, postId: string): Promise<LivePublishResult> {
  const post = await getSaasSocialPostById(ctx, postId);
  if (!post) {
    return { ok: false, post: null, account: null, code: "POST_NOT_FOUND", message: "Post not found." };
  }

  if (post.provider !== "LINKEDIN") {
    return {
      ok: false,
      post,
      account: null,
      code: "LIVE_PROVIDER_NOT_SUPPORTED",
      message: "Live publishing is currently available only for LinkedIn.",
    };
  }

  const accounts = await listSaasSocialAccounts(ctx);
  const publicationMeta = (post.metadata?.publication ?? null) as Record<string, unknown> | null;
  const accountId = typeof publicationMeta?.accountId === "string" ? publicationMeta.accountId : null;
  const account = pickLinkedInAccount(accounts, accountId);
  if (!account) {
    const failedPost = await upsertSaasSocialPost(ctx, {
      ...post,
      status: "FAILED",
      metadata: mergePublicationMetadata(post.metadata, {
        mode: "live",
        state: "failed",
        lastAttemptAt: new Date().toISOString(),
        errorCode: "LINKEDIN_ACCOUNT_REQUIRED",
        errorMessage: "Connect one live LinkedIn account before publishing.",
        accountId,
        accountHandle: accountId ? accounts.find((a) => a.id === accountId)?.handle : undefined,
      }),
    });
    return {
      ok: false,
      post: failedPost,
      account: null,
      code: "LINKEDIN_ACCOUNT_REQUIRED",
      message: "Connect one live LinkedIn account before publishing.",
    };
  }

  const accessToken = typeof account.authMeta?.accessToken === "string" ? account.authMeta.accessToken : null;
  const authorUrn = typeof account.authMeta?.authorUrn === "string" ? account.authMeta.authorUrn : null;
  if (!accessToken || !authorUrn) {
    const nextAccount = await upsertSaasSocialAccount(ctx, {
      id: account.id,
      saasId: account.saasId,
      provider: account.provider,
      handle: account.handle,
      displayName: account.displayName,
      status: "NEEDS_RECONNECTION",
      authMeta: {
        ...(account.authMeta ?? {}),
        token_status: "missing",
        lastErrorAt: new Date().toISOString(),
        lastErrorCode: "LINKEDIN_TOKEN_MISSING",
      },
      isPrimary: account.isPrimary,
    });
    const failedPost = await upsertSaasSocialPost(ctx, {
      ...post,
      status: "FAILED",
      metadata: mergePublicationMetadata(post.metadata, {
        mode: "live",
        state: "failed",
        lastAttemptAt: new Date().toISOString(),
        errorCode: "LINKEDIN_TOKEN_MISSING",
        errorMessage: "The live LinkedIn connection is missing access credentials.",
        accountId: account.id,
        accountHandle: account.handle,
      }),
    });
    return {
      ok: false,
      post: failedPost,
      account: nextAccount,
      code: "LINKEDIN_TOKEN_MISSING",
      message: "The live LinkedIn connection is missing access credentials.",
    };
  }

  try {
    const published = await publishLinkedInTextPost({
      accessToken,
      authorUrn,
      text: post.body,
    });
    const nextAccount = await upsertSaasSocialAccount(ctx, {
      id: account.id,
      saasId: account.saasId,
      provider: account.provider,
      handle: account.handle,
      displayName: account.displayName,
      status: "CONNECTED_REAL",
      authMeta: {
        ...(account.authMeta ?? {}),
        token_status: "active",
        lastLivePublishAt: published.publishedAt,
      },
      isPrimary: account.isPrimary,
    });
    const nextPost = await upsertSaasSocialPost(ctx, {
      ...post,
      status: "PUBLISHED",
      postedAt: published.publishedAt,
      externalPostId: published.externalPostId,
      metadata: mergePublicationMetadata(post.metadata, {
        mode: "live",
        state: "published",
        publishedAt: published.publishedAt,
        lastAttemptAt: published.publishedAt,
        externalPostId: published.externalPostId,
        accountId: account.id,
        accountHandle: account.handle,
      }),
    });
    return {
      ok: true,
      post: nextPost,
      account: nextAccount,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Live publish failed.";
    const errorCode = error instanceof LinkedInIntegrationError ? error.code : "LINKEDIN_PUBLISH_FAILED";
    const accountStatus = error instanceof LinkedInIntegrationError ? error.accountStatus : "PENDING_REAL";
    const nextAccount = await upsertSaasSocialAccount(ctx, {
      id: account.id,
      saasId: account.saasId,
      provider: account.provider,
      handle: account.handle,
      displayName: account.displayName,
      status: accountStatus,
      authMeta: {
        ...(account.authMeta ?? {}),
        token_status: accountStatus === "PENDING_REAL" ? "pending" : "invalid",
        lastErrorAt: new Date().toISOString(),
        lastErrorCode: errorCode,
        lastErrorMessage: errorMessage,
      },
      isPrimary: account.isPrimary,
    });
    const failedPost = await upsertSaasSocialPost(ctx, {
      ...post,
      status: "FAILED",
      metadata: mergePublicationMetadata(post.metadata, {
        mode: "live",
        state: "failed",
        lastAttemptAt: new Date().toISOString(),
        errorCode,
        errorMessage,
        accountId: account.id,
        accountHandle: account.handle,
      }),
    });
    return {
      ok: false,
      post: failedPost,
      account: nextAccount,
      code: errorCode,
      message: errorMessage,
    };
  }
}
