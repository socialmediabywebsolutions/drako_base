import { decryptToken } from "@/lib/socialflow/token-encryption";
import type { SaasSocialAccount } from "@/lib/social-core/types";

// ---------------------------------------------------------------------------
// API bases — instagram_business_login uses graph.instagram.com,
// classic Facebook-Pages flow uses graph.facebook.com
// ---------------------------------------------------------------------------

const IG_GRAPH_BASE = "https://graph.instagram.com/v22.0";
const FB_GRAPH_BASE = "https://graph.facebook.com/v19.0";

// fetch() awaits don't count toward Workers CPU time — use wall-clock budget.
const VIDEO_POLL_INTERVAL_MS = 2_000;
const VIDEO_POLL_MAX_MS = 90_000;

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class InstagramPublishingError extends Error {
  code: string;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: { code: string; details?: Record<string, unknown> | null },
  ) {
    super(message);
    this.name = "InstagramPublishingError";
    this.code = opts.code;
    this.details = opts.details ?? null;
  }
}

export class FacebookPublishingError extends Error {
  code: string;
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: { code: string; details?: Record<string, unknown> | null },
  ) {
    super(message);
    this.name = "FacebookPublishingError";
    this.code = opts.code;
    this.details = opts.details ?? null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateCaption(text: string, maxLen = 2200): string {
  if (text.length <= maxLen) return text;
  const cut = text.lastIndexOf(" ", maxLen - 3);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, maxLen - 3)) + "...";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InstagramPostContentType = "FEED" | "REEL" | "SHORT" | "STORY";

export type InstagramPublishInput = {
  accessToken: string;
  igUserId: string;
  apiBase: string;
  caption: string;
  contentType: InstagramPostContentType;
  mediaUrl: string;
};

export type InstagramPublishResult = {
  externalPostId: string;
  containerId: string;
  mediaType: string;
};

export type InstagramCredentials = {
  accessToken: string;
  igUserId: string;
  authType: string;
  apiBase: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function parseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const payload = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getApiErrorMessage(payload: Record<string, unknown> | null, fallback: string): string {
  const err = payload?.error;
  if (err && typeof err === "object" && !Array.isArray(err)) {
    const msg = (err as Record<string, unknown>).message;
    if (typeof msg === "string" && msg.trim()) return msg.trim();
  }
  return fallback;
}

function classifyInstagramError(status: number, defaultCode: string): string {
  if (status === 401) return "INSTAGRAM_TOKEN_INVALID";
  if (status === 403) return "INSTAGRAM_PUBLISH_FORBIDDEN";
  if (status === 429) return "INSTAGRAM_PUBLISH_RATE_LIMITED";
  if (status === 400) return "INSTAGRAM_PUBLISH_INVALID_REQUEST";
  return defaultCode;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|mkv|webm)(\?|$)/i.test(url);
}

// ---------------------------------------------------------------------------
// Video container status polling
// ---------------------------------------------------------------------------

async function waitForVideoContainer(
  apiBase: string,
  containerId: string,
  accessToken: string,
): Promise<void> {
  const deadline = Date.now() + VIDEO_POLL_MAX_MS;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));

    const url = new URL(`${apiBase}/${containerId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", accessToken);

    const res = await fetch(url.toString(), { cache: "no-store" });
    const payload = await parseJson(res);
    const statusCode = typeof payload?.status_code === "string" ? payload.status_code : "";

    console.log("INSTAGRAM_CONTAINER_STATUS", { containerId, statusCode });

    if (statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new InstagramPublishingError(
        `Video container failed with status: ${statusCode}`,
        { code: "INSTAGRAM_CONTAINER_FAILED", details: { statusCode, ...payload } },
      );
    }
    // IN_PROGRESS or PUBLISHED_WITH_PENDING_REVIEW → keep polling
  }

  throw new InstagramPublishingError(
    `Video container processing timed out after ${VIDEO_POLL_MAX_MS}ms.`,
    { code: "INSTAGRAM_CONTAINER_TIMEOUT", details: { containerId, maxWaitMs: VIDEO_POLL_MAX_MS } },
  );
}

// ---------------------------------------------------------------------------
// Public API — unified content publisher (Feed / Reel / Story)
// ---------------------------------------------------------------------------

export async function publishInstagramContent(
  input: InstagramPublishInput,
): Promise<InstagramPublishResult> {
  const { accessToken, igUserId, apiBase, contentType, mediaUrl } = input;
  const caption = truncateCaption(input.caption.trim());

  if (!mediaUrl.startsWith("http")) {
    throw new InstagramPublishingError(
      "A public HTTPS media URL is required (set imageHint on the post).",
      { code: "INSTAGRAM_MEDIA_REQUIRED" },
    );
  }

  const isReel = contentType === "REEL" || contentType === "SHORT";
  const isStory = contentType === "STORY";
  const isVideoStory = isStory && isVideoUrl(mediaUrl);
  // Poll container status for all content types: videos need it for FINISHED,
  // images can also return IN_PROGRESS briefly after container creation.
  const needsVideoPolling = true;

  // Step 1 — Build and POST the media container
  const containerUrl = new URL(`${apiBase}/${igUserId}/media`);
  containerUrl.searchParams.set("access_token", accessToken);

  if (isReel) {
    containerUrl.searchParams.set("media_type", "REELS");
    containerUrl.searchParams.set("video_url", mediaUrl);
    containerUrl.searchParams.set("caption", caption.trim());
    containerUrl.searchParams.set("share_to_feed", "true");
  } else if (isStory) {
    containerUrl.searchParams.set("media_type", "STORIES");
    if (isVideoStory) {
      containerUrl.searchParams.set("video_url", mediaUrl);
    } else {
      containerUrl.searchParams.set("image_url", mediaUrl);
    }
    // Stories do not support captions via the API
  } else {
    // FEED — image post
    containerUrl.searchParams.set("image_url", mediaUrl);
    containerUrl.searchParams.set("caption", caption.trim());
  }

  const mediaType = isReel ? "REELS" : isStory ? "STORIES" : "IMAGE";
  console.log("INSTAGRAM_CONTAINER_CREATE", { igUserId, mediaType, apiBase });

  const containerRes = await fetch(containerUrl.toString(), {
    method: "POST",
    cache: "no-store",
  });
  const containerPayload = await parseJson(containerRes);

  if (!containerRes.ok) {
    throw new InstagramPublishingError(
      getApiErrorMessage(containerPayload, "Instagram media container creation failed."),
      {
        code: classifyInstagramError(containerRes.status, "INSTAGRAM_CONTAINER_CREATE_FAILED"),
        details: { status: containerRes.status, ...(containerPayload ?? {}) },
      },
    );
  }

  const containerId =
    typeof containerPayload?.id === "string" ? containerPayload.id.trim() : null;
  if (!containerId) {
    throw new InstagramPublishingError(
      "Instagram container creation returned no ID.",
      { code: "INSTAGRAM_CONTAINER_ID_MISSING", details: containerPayload },
    );
  }

  console.log("INSTAGRAM_CONTAINER_CREATED", { containerId, needsVideoPolling });

  // Step 1.5 — For video content, wait until Instagram finishes processing
  if (needsVideoPolling) {
    await waitForVideoContainer(apiBase, containerId, accessToken);
  }

  // Step 2 — Publish the container
  const publishUrl = new URL(`${apiBase}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("creation_id", containerId);
  publishUrl.searchParams.set("access_token", accessToken);

  const publishRes = await fetch(publishUrl.toString(), {
    method: "POST",
    cache: "no-store",
  });
  const publishPayload = await parseJson(publishRes);

  if (!publishRes.ok) {
    throw new InstagramPublishingError(
      getApiErrorMessage(publishPayload, "Instagram media publish failed."),
      {
        code: classifyInstagramError(publishRes.status, "INSTAGRAM_PUBLISH_FAILED"),
        details: { status: publishRes.status, containerId, ...(publishPayload ?? {}) },
      },
    );
  }

  const mediaId =
    typeof publishPayload?.id === "string" ? publishPayload.id.trim() : null;
  if (!mediaId) {
    throw new InstagramPublishingError(
      "Instagram publish returned no media ID.",
      { code: "INSTAGRAM_MEDIA_ID_MISSING", details: { containerId, ...publishPayload } },
    );
  }

  console.log("INSTAGRAM_PUBLISH_OK", { mediaId, mediaType, containerId });
  return { externalPostId: mediaId, containerId, mediaType };
}

// ---------------------------------------------------------------------------
// Public API — Facebook Page publisher (empresa accounts only, gated in live-publishing.ts)
// ---------------------------------------------------------------------------

function classifyFacebookError(status: number, defaultCode: string): string {
  if (status === 401) return "FACEBOOK_TOKEN_INVALID";
  if (status === 403) return "FACEBOOK_PUBLISH_FORBIDDEN";
  if (status === 429) return "FACEBOOK_PUBLISH_RATE_LIMITED";
  if (status === 400) return "FACEBOOK_PUBLISH_INVALID_REQUEST";
  return defaultCode;
}

export type FacebookPublishInput = {
  accessToken: string;
  pageId: string;
  caption: string;
  // Feed posts (FEED/CAROUSEL) only — REEL/STORY on Facebook Page need the
  // resumable video-upload API and are not implemented here.
  mediaUrl?: string | null;
};

export type FacebookPublishResult = {
  externalPostId: string;
};

export type FacebookCredentials = {
  accessToken: string;
  pageId: string;
};

export async function publishFacebookPageContent(
  input: FacebookPublishInput,
): Promise<FacebookPublishResult> {
  const { accessToken, pageId } = input;
  const caption = truncateCaption(input.caption.trim());
  const mediaUrl = input.mediaUrl?.trim() ?? "";

  // Image caption post via /{pageId}/photos; falls back to a text-only /{pageId}/feed
  // post when the AI pipeline didn't attach a media URL.
  const usesPhoto = mediaUrl.startsWith("http");
  const endpoint = usesPhoto ? `${FB_GRAPH_BASE}/${pageId}/photos` : `${FB_GRAPH_BASE}/${pageId}/feed`;
  const url = new URL(endpoint);
  url.searchParams.set("access_token", accessToken);
  if (usesPhoto) {
    url.searchParams.set("url", mediaUrl);
    url.searchParams.set("caption", caption);
  } else {
    url.searchParams.set("message", caption);
  }

  console.log("FACEBOOK_PUBLISH_ATTEMPT", { pageId, usesPhoto });

  const res = await fetch(url.toString(), { method: "POST", cache: "no-store" });
  const payload = await parseJson(res);

  if (!res.ok) {
    throw new FacebookPublishingError(
      getApiErrorMessage(payload, "Facebook Page publish failed."),
      {
        code: classifyFacebookError(res.status, "FACEBOOK_PUBLISH_FAILED"),
        details: { status: res.status, ...(payload ?? {}) },
      },
    );
  }

  // /photos returns { id, post_id }: post_id is the resulting feed post, id is the photo.
  // /feed returns { id } directly as the post id.
  const externalPostId =
    (typeof payload?.post_id === "string" && payload.post_id.trim()) ||
    (typeof payload?.id === "string" && payload.id.trim()) ||
    null;
  if (!externalPostId) {
    throw new FacebookPublishingError(
      "Facebook Page publish returned no post ID.",
      { code: "FACEBOOK_POST_ID_MISSING", details: payload },
    );
  }

  console.log("FACEBOOK_PUBLISH_OK", { externalPostId, usesPhoto });
  return { externalPostId };
}

export async function requireFacebookPageCredentials(
  account: SaasSocialAccount,
): Promise<FacebookCredentials> {
  const authMeta = (account.authMeta ?? {}) as Record<string, unknown>;
  const encryptedToken =
    typeof authMeta.accessToken === "string" ? authMeta.accessToken.trim() : "";
  const pageId =
    typeof authMeta.pageId === "string" ? authMeta.pageId.trim() : "";

  if (!encryptedToken) {
    throw new FacebookPublishingError(
      "Facebook Page access token is missing from account credentials.",
      { code: "FACEBOOK_ACCESS_TOKEN_MISSING" },
    );
  }
  if (!pageId) {
    throw new FacebookPublishingError(
      "Facebook Page ID is missing from account credentials.",
      { code: "FACEBOOK_PAGE_ID_MISSING" },
    );
  }

  const accessToken = await decryptToken(encryptedToken);
  if (!accessToken) {
    throw new FacebookPublishingError(
      "Facebook Page access token decryption failed.",
      { code: "FACEBOOK_ACCESS_TOKEN_DECRYPTION_FAILED" },
    );
  }

  return { accessToken, pageId };
}

// ---------------------------------------------------------------------------
// Public API — credential resolution
// ---------------------------------------------------------------------------

export async function requireInstagramCredentials(
  account: SaasSocialAccount,
): Promise<InstagramCredentials> {
  const authMeta = (account.authMeta ?? {}) as Record<string, unknown>;
  const encryptedToken =
    typeof authMeta.accessToken === "string" ? authMeta.accessToken.trim() : "";
  const igUserId =
    typeof authMeta.igUserId === "string" ? authMeta.igUserId.trim() : "";
  const authType =
    typeof authMeta.authType === "string" ? authMeta.authType : "";

  if (!encryptedToken) {
    throw new InstagramPublishingError(
      "Instagram access token is missing from account credentials.",
      { code: "INSTAGRAM_ACCESS_TOKEN_MISSING" },
    );
  }
  if (!igUserId) {
    throw new InstagramPublishingError(
      "Instagram user ID (igUserId) is missing from account credentials.",
      { code: "INSTAGRAM_USER_ID_MISSING" },
    );
  }

  const accessToken = await decryptToken(encryptedToken);
  if (!accessToken) {
    throw new InstagramPublishingError(
      "Instagram access token decryption failed.",
      { code: "INSTAGRAM_ACCESS_TOKEN_DECRYPTION_FAILED" },
    );
  }

  // instagram_business_login tokens use graph.instagram.com;
  // classic Facebook-Pages tokens use graph.facebook.com.
  const apiBase = authType === "instagram_business_login" ? IG_GRAPH_BASE : FB_GRAPH_BASE;

  return { accessToken, igUserId, authType, apiBase };
}

// ---------------------------------------------------------------------------
// Legacy alias — kept for any callers that predate requireInstagramCredentials
// ---------------------------------------------------------------------------

/** @deprecated Use requireInstagramCredentials instead. */
export async function requireInstagramPageToken(
  account: SaasSocialAccount,
): Promise<{ pageToken: string; igUserId: string }> {
  const creds = await requireInstagramCredentials(account);
  return { pageToken: creds.accessToken, igUserId: creds.igUserId };
}

/** @deprecated Use publishInstagramContent instead. */
export async function publishInstagramPost(input: {
  pageToken: string;
  igUserId: string;
  caption: string;
  imageUrl?: string | null;
}): Promise<InstagramPublishResult> {
  return publishInstagramContent({
    accessToken: input.pageToken,
    igUserId: input.igUserId,
    apiBase: FB_GRAPH_BASE,
    caption: input.caption,
    contentType: "FEED",
    mediaUrl: input.imageUrl ?? "",
  });
}
