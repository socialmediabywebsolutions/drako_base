import type { SaasSocialPost, SaasSocialProvider } from "@/lib/social/types";
import { getSaasSocialPostById, listSaasSocialAccounts, updateSaasSocialPostStatus } from "@/lib/social/repository";
import type { SocialContext } from "@/lib/social/repository";

type LinkedInAuthMeta = {
  accessToken?: string;
  authorUrn?: string;
  profileId?: string;
  token_status?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  [key: string]: unknown;
};

async function findPrimaryLinkedInAccount(ctx: SocialContext): Promise<{ authMeta: LinkedInAuthMeta } | null> {
  const accounts = await listSaasSocialAccounts(ctx);
  const linkedin = accounts.find((account) => account.provider === "LINKEDIN" && account.isPrimary);
  if (!linkedin) return null;
  return { authMeta: (linkedin.authMeta ?? {}) as LinkedInAuthMeta };
}

async function publishToLinkedIn(input: {
  provider: SaasSocialProvider;
  auth: LinkedInAuthMeta;
  post: SaasSocialPost;
}): Promise<{ externalPostId?: string | null }> {
  if (input.provider !== "LINKEDIN") {
    throw new Error("UNSUPPORTED_PROVIDER_FOR_LIVE_PUBLISHING");
  }

  const accessToken = (input.auth.accessToken ?? "").trim();
  const authorUrn = (input.auth.authorUrn ?? "").trim();

  if (!accessToken || !authorUrn) {
    throw new Error("LINKEDIN_CREDENTIALS_MISSING");
  }

  const body = {
    author: authorUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: input.post.body || input.post.title,
        },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const message = text || `HTTP_${response.status}`;
    throw new Error(`LINKEDIN_PUBLISH_FAILED:${message}`);
  }

  // LinkedIn returns the URN of the created post in the "x-restli-id" header for some endpoints.
  const externalPostId = response.headers.get("x-restli-id");
  return { externalPostId };
}

export async function publishSocialPostLive(
  ctx: SocialContext,
  postId: string,
): Promise<{ ok: boolean; code?: string; message?: string; externalPostId?: string | null; post: SaasSocialPost | null }> {
  try {
    const post = await getSaasSocialPostById(ctx, postId);

    if (!post) {
      return { ok: false, code: "POST_NOT_FOUND", message: "Post not found", post: null };
    }

    console.log(`[SocialFlow] Live publish started for post ${postId} (Provider: ${post.provider})`);

    if (post.provider !== "LINKEDIN") {
      console.error(`[SocialFlow] Unsupported provider for live publishing: ${post.provider}`);
      await updateSaasSocialPostStatus(ctx, {
        id: postId,
        status: "FAILED",
      });
      return {
        ok: false,
        code: "UNSUPPORTED_PROVIDER",
        message: `Provider ${post.provider} is not supported for live publishing`,
        externalPostId: null,
        post: null,
      };
    }

    const account = await findPrimaryLinkedInAccount(ctx);
    if (!account) {
      console.error("[SocialFlow] No primary LinkedIn account configured for live publishing.");
      await updateSaasSocialPostStatus(ctx, {
        id: postId,
        status: "FAILED",
      });
      return {
        ok: false,
        code: "LINKEDIN_ACCOUNT_MISSING",
        message: "No primary LinkedIn account configured for this workspace.",
        externalPostId: null,
        post: null,
      };
    }

    let externalPostId: string | null | undefined = null;

    try {
      const result = await publishToLinkedIn({
        provider: post.provider,
        auth: account.authMeta,
        post,
      });
      externalPostId = result.externalPostId ?? null;
    } catch (providerError) {
      console.error(`[SocialFlow] LinkedIn publish failed for post ${postId}`, providerError);

      await updateSaasSocialPostStatus(ctx, {
        id: postId,
        status: "FAILED",
      });

      return {
        ok: false,
        code: "LINKEDIN_PUBLISH_FAILED",
        message: providerError instanceof Error ? providerError.message : "LinkedIn publish failed",
        externalPostId: null,
        post: null,
      };
    }

    const updatedPost = await updateSaasSocialPostStatus(ctx, {
      id: postId,
      status: "PUBLISHED",
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
      post: null,
    };
  }
}
