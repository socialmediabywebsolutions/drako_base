export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import {
  getSaasSocialPostById,
  listSaasSocialAccounts,
  markAsPosted,
  resolveSocialContext,
  SocialContextError,
  updateSaasSocialPostStatus,
  type SocialContext,
} from "@/lib/socialflow/repository";
import {
  FacebookPublishingError,
  publishFacebookPageContent,
  requireFacebookPageCredentials,
} from "@/lib/socialflow/meta/publishing";

const DEFAULT_SAAS_ID = "socialflow";

type FacebookPublishRequestBody = {
  post_id?: string;
  text?: string;
  image_url?: string;
  saasId?: string;
};

function json(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status });
}

async function findPrimaryFacebookAccount(ctx: SocialContext) {
  const accounts = await listSaasSocialAccounts(ctx);
  return (
    accounts.find((a) => a.provider === "FACEBOOK_PAGE" && a.isPrimary && a.status === "CONNECTED_REAL") ??
    accounts.find((a) => a.provider === "FACEBOOK_PAGE" && a.status === "CONNECTED_REAL") ??
    null
  );
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => ({}))) as FacebookPublishRequestBody;

    const postId = body.post_id?.trim() || "";
    const text = body.text?.trim() || "";
    const imageUrl = body.image_url?.trim() || null;
    const saasId = body.saasId?.trim() || DEFAULT_SAAS_ID;

    if (!postId) {
      return json({ ok: false, code: "INVALID_PARAMS", message: "post_id is required" }, 400);
    }
    if (!text && !imageUrl) {
      return json({ ok: false, code: "INVALID_PARAMS", message: "text or image_url is required" }, 400);
    }

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });

    const account = await findPrimaryFacebookAccount(ctx);
    if (!account) {
      return json(
        { ok: false, code: "FACEBOOK_ACCOUNT_MISSING", message: "No connected Facebook Page account found for this workspace." },
        422,
      );
    }

    const credentials = await requireFacebookPageCredentials(account);

    let result;
    try {
      result = await publishFacebookPageContent({
        accessToken: credentials.accessToken,
        pageId: credentials.pageId,
        caption: text,
        mediaUrl: imageUrl,
      });
    } catch (error) {
      const code = error instanceof FacebookPublishingError ? error.code : "FACEBOOK_PUBLISH_FAILED";
      const message = error instanceof Error ? error.message : "Facebook Page publish failed.";
      const existingPost = await getSaasSocialPostById(ctx, postId).catch(() => null);
      if (existingPost) {
        await updateSaasSocialPostStatus(ctx, { id: postId, status: "FAILED" }).catch(() => {});
      }
      return json({ ok: false, code, message }, 502);
    }

    const existingPost = await getSaasSocialPostById(ctx, postId).catch(() => null);
    const post = existingPost
      ? await markAsPosted(ctx, { id: postId, externalPostId: result.externalPostId, postedAt: new Date().toISOString() }).catch(() => existingPost)
      : null;

    return json({ ok: true, externalPostId: result.externalPostId, post }, 200);
  } catch (error) {
    if (error instanceof SocialContextError) {
      return json({ ok: false, code: "INVALID_SOCIAL_CONTEXT", message: error.message }, 400);
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return json({ ok: false, code: "SESSION_REQUIRED" }, 401);
    }
    console.error("SOCIALFLOW_FACEBOOK_PUBLISH_ERROR", error);
    return json(
      { ok: false, code: "FACEBOOK_PUBLISH_ERROR", message: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
}
