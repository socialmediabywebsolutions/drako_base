export const dynamic = "force-dynamic";

/**
 * Test endpoint — publishes an image post, a Reel, and a Story to a connected
 * Instagram Business account. Protected by CRON_SECRET.
 *
 * POST /api/socialflow/test/instagram-publish
 * Authorization: Bearer <CRON_SECRET>
 *
 * Body:
 * {
 *   "tenantId": "...",
 *   "saasId": "...",
 *   "imageUrl": "https://...",   // public HTTPS JPEG/PNG (min 320×320, max 8MB)
 *   "videoUrl": "https://...",   // public HTTPS MP4 (H.264, AAC, 9:16, 3–90s)
 *   "caption": "optional caption"
 * }
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { resolveSocialContext, listSaasSocialAccounts } from "@/lib/socialflow/repository";
import {
  requireInstagramCredentials,
  publishInstagramContent,
  InstagramPublishingError,
  type InstagramPostContentType,
} from "@/lib/socialflow/meta/publishing";

function verifyCronSecret(request: Request): boolean {
  const cronSecret = env()?.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = (request.headers.get("authorization") ?? "").trim();
  return auth === `Bearer ${cronSecret}` || auth === cronSecret;
}

type TestCaseResult = {
  ok: boolean;
  externalPostId?: string;
  containerId?: string;
  mediaType?: string;
  error?: string;
  code?: string;
};

async function runTest(
  creds: Awaited<ReturnType<typeof requireInstagramCredentials>>,
  contentType: InstagramPostContentType,
  mediaUrl: string,
  caption: string,
): Promise<TestCaseResult> {
  try {
    const result = await publishInstagramContent({
      accessToken: creds.accessToken,
      igUserId: creds.igUserId,
      apiBase: creds.apiBase,
      contentType,
      mediaUrl,
      caption,
    });
    return { ok: true, ...result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      code: err instanceof InstagramPublishingError ? err.code : "UNKNOWN_ERROR",
    };
  }
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const saasId = typeof body.saasId === "string" ? body.saasId.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "Test publicación SocialFlow";

  const missing: string[] = [];
  if (!tenantId) missing.push("tenantId");
  if (!saasId) missing.push("saasId");
  if (!imageUrl) missing.push("imageUrl");
  if (!videoUrl) missing.push("videoUrl");
  if (missing.length > 0) {
    return NextResponse.json(
      { code: "INVALID_PARAMS", message: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  let ctx;
  try {
    ctx = await resolveSocialContext({ tenantId, saasId });
  } catch (err) {
    return NextResponse.json(
      { code: "CONTEXT_ERROR", message: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const accounts = await listSaasSocialAccounts(ctx);

  // Prefer instagram_business_login accounts; fall back to any connected Instagram account.
  const igAccount =
    accounts.find(
      (a) =>
        a.provider === "INSTAGRAM" &&
        (a.authMeta as Record<string, unknown>)?.authType === "instagram_business_login" &&
        a.status === "CONNECTED_REAL",
    ) ??
    accounts.find((a) => a.provider === "INSTAGRAM" && a.status === "CONNECTED_REAL") ??
    null;

  if (!igAccount) {
    return NextResponse.json(
      {
        code: "NO_INSTAGRAM_ACCOUNT",
        message: "No connected Instagram account found for this saasId.",
        accountsFound: accounts.length,
      },
      { status: 422 },
    );
  }

  let creds: Awaited<ReturnType<typeof requireInstagramCredentials>>;
  try {
    creds = await requireInstagramCredentials(igAccount);
  } catch (err) {
    return NextResponse.json(
      {
        code: err instanceof InstagramPublishingError ? err.code : "CREDENTIAL_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 422 },
    );
  }

  console.log("INSTAGRAM_TEST_PUBLISH_START", {
    saasId,
    igUserId: creds.igUserId,
    authType: creds.authType,
    apiBase: creds.apiBase,
  });

  // Run the three test cases sequentially to avoid rate limits.
  const imageResult = await runTest(creds, "FEED", imageUrl, `[IMAGE] ${caption}`);
  const reelResult = await runTest(creds, "REEL", videoUrl, `[REEL] ${caption}`);
  const storyResult = await runTest(creds, "STORY", imageUrl, "");

  const allOk = imageResult.ok && reelResult.ok && storyResult.ok;

  console.log("INSTAGRAM_TEST_PUBLISH_DONE", {
    saasId,
    allOk,
    imageOk: imageResult.ok,
    reelOk: reelResult.ok,
    storyOk: storyResult.ok,
  });

  return NextResponse.json({
    ok: allOk,
    account: {
      id: igAccount.id,
      igUserId: creds.igUserId,
      authType: creds.authType,
      apiBase: creds.apiBase,
    },
    results: {
      imageFeedPost: imageResult,
      reel: reelResult,
      storyImage: storyResult,
    },
  });
}
