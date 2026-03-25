import type { SaasSocialPost, SaasSocialProvider } from "@/lib/social/types";
import { publishPost } from "@/lib/social/linkedin-service";
import { getSaasSocialPostById, listSaasSocialAccounts, markAsPosted, updateSaasSocialPostStatus } from "@/lib/social/repository";
import type { SocialContext } from "@/lib/social/repository";

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
        account,
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
      post: null,
    };
  }
}
