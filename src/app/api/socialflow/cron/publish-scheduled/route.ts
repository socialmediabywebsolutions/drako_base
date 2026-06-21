export const dynamic = "force-dynamic";

/**
 * POST /api/socialflow/cron/publish-scheduled
 * x-cron-secret: <CRON_SECRET>
 *
 * Publishes a single post to Instagram (or other platforms in the future).
 * Designed for direct invocation from Cloudflare Cron or manual curl tests.
 *
 * Body:
 * {
 *   "tenantId": "...",
 *   "saasId": "...",
 *   "accountId": "...",           // ID of the connected SaasSocialAccount
 *   "platform": "instagram",
 *   "postType": "feed" | "reel" | "story",
 *   "caption": "...",
 *   "imageHint": "https://..."    // public HTTPS media URL
 * }
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { resolveSocialContext, listSaasSocialAccounts, SocialContextError } from "@/lib/socialflow/repository";
import {
  requireInstagramCredentials,
  publishInstagramContent,
  InstagramPublishingError,
  type InstagramPostContentType,
} from "@/lib/socialflow/meta/publishing";

function verifyCronSecret(request: Request): boolean {
  const cronSecret = env()?.CRON_SECRET;
  if (!cronSecret) return false;
  const fromHeader = (request.headers.get("x-cron-secret") ?? "").trim();
  const fromAuth = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return fromHeader === cronSecret || fromAuth === cronSecret;
}

function mapPostType(postType: string): InstagramPostContentType {
  switch (postType.toLowerCase()) {
    case "reel": return "REEL";
    case "story": return "STORY";
    default: return "FEED";
  }
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const tenantId = typeof body.tenantId === "string" ? body.tenantId.trim() : "";
  const saasId = typeof body.saasId === "string" ? body.saasId.trim() : "";
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : "";
  const postType = typeof body.postType === "string" ? body.postType.trim() : "feed";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const imageHint = typeof body.imageHint === "string" ? body.imageHint.trim() : "";

  const missing: string[] = [];
  if (!tenantId) missing.push("tenantId");
  if (!saasId) missing.push("saasId");
  if (!accountId) missing.push("accountId");
  if (!platform) missing.push("platform");
  if (!imageHint) missing.push("imageHint");
  if (missing.length > 0) {
    return NextResponse.json(
      { ok: false, code: "INVALID_PARAMS", message: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  if (platform !== "instagram") {
    return NextResponse.json(
      { ok: false, code: "UNSUPPORTED_PLATFORM", message: `Platform '${platform}' is not supported yet.` },
      { status: 400 },
    );
  }

  let ctx;
  try {
    ctx = await resolveSocialContext({ tenantId, saasId });
  } catch (err) {
    return NextResponse.json(
      { ok: false, code: "CONTEXT_ERROR", message: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }

  const accounts = await listSaasSocialAccounts(ctx);
  const account = accounts.find((a) => a.id === accountId) ?? null;

  if (!account) {
    return NextResponse.json(
      {
        ok: false,
        code: "ACCOUNT_NOT_FOUND",
        message: `Account ${accountId} not found for tenantId=${tenantId} saasId=${saasId}.`,
        availableIds: accounts.map((a) => ({ id: a.id, provider: a.provider, status: a.status })),
      },
      { status: 404 },
    );
  }

  if (account.status !== "CONNECTED_REAL") {
    return NextResponse.json(
      { ok: false, code: "ACCOUNT_NOT_CONNECTED", message: `Account ${accountId} has status '${account.status}', expected CONNECTED_REAL.` },
      { status: 422 },
    );
  }

  let creds: Awaited<ReturnType<typeof requireInstagramCredentials>>;
  try {
    creds = await requireInstagramCredentials(account);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        code: err instanceof InstagramPublishingError ? err.code : "CREDENTIAL_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 422 },
    );
  }

  const contentType = mapPostType(postType);

  console.log("CRON_PUBLISH_SCHEDULED_START", {
    tenantId,
    saasId,
    accountId,
    platform,
    contentType,
    igUserId: creds.igUserId,
    authType: creds.authType,
    apiBase: creds.apiBase,
    imageHint,
  });

  try {
    const result = await publishInstagramContent({
      accessToken: creds.accessToken,
      igUserId: creds.igUserId,
      apiBase: creds.apiBase,
      caption,
      contentType,
      mediaUrl: imageHint,
    });

    console.log("CRON_PUBLISH_SCHEDULED_OK", {
      tenantId,
      saasId,
      accountId,
      externalPostId: result.externalPostId,
      mediaType: result.mediaType,
    });

    return NextResponse.json({
      ok: true,
      externalPostId: result.externalPostId,
      containerId: result.containerId,
      mediaType: result.mediaType,
      account: {
        id: account.id,
        handle: account.handle,
        igUserId: creds.igUserId,
        authType: creds.authType,
        apiBase: creds.apiBase,
      },
    });
  } catch (err) {
    const code = err instanceof InstagramPublishingError ? err.code : "INSTAGRAM_PUBLISH_FAILED";
    const message = err instanceof Error ? err.message : String(err);
    const details = err instanceof InstagramPublishingError ? err.details : null;

    console.error("CRON_PUBLISH_SCHEDULED_ERROR", JSON.stringify({ code, message, details, tenantId, saasId, accountId }));

    return NextResponse.json(
      { ok: false, code, message, details },
      { status: 422 },
    );
  }
}
