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

// Instagram Graph API hard limits for carousel posts.
export const CAROUSEL_MIN_ITEMS = 2;
export const CAROUSEL_MAX_ITEMS = 10;

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

export type InstagramPostContentType = "FEED" | "REEL" | "SHORT" | "STORY" | "CAROUSEL";

export type InstagramPublishInput = {
  accessToken: string;
  igUserId: string;
  apiBase: string;
  caption: string;
  contentType: InstagramPostContentType;
  // Required for FEED/REEL/SHORT/STORY. Ignored for CAROUSEL.
  mediaUrl?: string;
  // Required for CAROUSEL — 2 to 10 public HTTPS image URLs, one per slide, in order.
  mediaUrls?: string[];
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
  // "BUSINESS" | "MEDIA_CREATOR" | null — only captured for instagram_business_login
  // accounts (see instagram/oauth.ts's fetchInstagramUser); legacy Facebook-Page
  // accounts never fetch account_type, so this stays null for them.
  accountType: string | null;
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

// error.code 2021 = OAuthException "Invalid User Credentials" — el código real que Meta
// devuelve en el body cuando el Long-Lived Token ya expiró o fue revocado, sea cual sea
// el status HTTP con el que venga envuelto (400 y 401 se han visto ambos en la práctica
// para este mismo código). Se comprueba ANTES que el resto de reglas por status —
// "token caducado" es una categoría más específica y accionable (el cliente necesita
// reconectar la cuenta, ver token-health.ts) que "TOKEN_INVALID" genérico.
function classifyInstagramError(status: number, payload: Record<string, unknown> | null, defaultCode: string): string {
  const err = payload?.error;
  const errorCode = err && typeof err === "object" && !Array.isArray(err) ? (err as Record<string, unknown>).code : undefined;
  if (errorCode === 2021) return "INSTAGRAM_TOKEN_EXPIRED";

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
  contextLabel?: string,
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

    console.log("INSTAGRAM_CONTAINER_STATUS", {
      containerId,
      statusCode,
      ...(contextLabel ? { contextLabel } : {}),
    });

    if (statusCode === "FINISHED") return;
    if (statusCode === "ERROR" || statusCode === "EXPIRED") {
      throw new InstagramPublishingError(
        `Video container failed with status: ${statusCode}`,
        {
          code: "INSTAGRAM_CONTAINER_FAILED",
          details: { statusCode, ...(contextLabel ? { contextLabel } : {}), ...payload },
        },
      );
    }
    // IN_PROGRESS or PUBLISHED_WITH_PENDING_REVIEW → keep polling
  }

  throw new InstagramPublishingError(
    `Video container processing timed out after ${VIDEO_POLL_MAX_MS}ms.`,
    {
      code: "INSTAGRAM_CONTAINER_TIMEOUT",
      details: {
        containerId,
        maxWaitMs: VIDEO_POLL_MAX_MS,
        ...(contextLabel ? { contextLabel } : {}),
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Carousel — child item containers + parent container + publish
// ---------------------------------------------------------------------------

async function createCarouselItemContainer(
  apiBase: string,
  igUserId: string,
  accessToken: string,
  mediaUrl: string,
): Promise<string> {
  if (!mediaUrl.startsWith("http")) {
    throw new InstagramPublishingError(
      "A public HTTPS media URL is required for every carousel slide.",
      { code: "INSTAGRAM_CAROUSEL_ITEM_MEDIA_REQUIRED" },
    );
  }
  if (isVideoUrl(mediaUrl)) {
    throw new InstagramPublishingError(
      "Video carousel items are not supported — carousels must be image-only.",
      { code: "INSTAGRAM_CAROUSEL_VIDEO_UNSUPPORTED", details: { mediaUrl } },
    );
  }

  const url = new URL(`${apiBase}/${igUserId}/media`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("image_url", mediaUrl);
  url.searchParams.set("is_carousel_item", "true");

  const res = await fetch(url.toString(), { method: "POST", cache: "no-store" });
  const payload = await parseJson(res);

  if (!res.ok) {
    throw new InstagramPublishingError(
      getApiErrorMessage(payload, "Instagram carousel item container creation failed."),
      {
        code: classifyInstagramError(res.status, payload, "INSTAGRAM_CAROUSEL_ITEM_CREATE_FAILED"),
        details: { status: res.status, mediaUrl, ...(payload ?? {}) },
      },
    );
  }

  const containerId = typeof payload?.id === "string" ? payload.id.trim() : null;
  if (!containerId) {
    throw new InstagramPublishingError(
      "Instagram carousel item container creation returned no ID.",
      { code: "INSTAGRAM_CAROUSEL_ITEM_ID_MISSING", details: { mediaUrl, ...payload } },
    );
  }
  return containerId;
}

async function publishInstagramCarousel(input: {
  accessToken: string;
  igUserId: string;
  apiBase: string;
  caption: string;
  mediaUrls: string[];
}): Promise<InstagramPublishResult> {
  const { accessToken, igUserId, apiBase, caption, mediaUrls } = input;

  if (mediaUrls.length < CAROUSEL_MIN_ITEMS) {
    throw new InstagramPublishingError(
      `A carousel needs at least ${CAROUSEL_MIN_ITEMS} slides.`,
      { code: "INSTAGRAM_CAROUSEL_MIN_ITEMS", details: { count: mediaUrls.length } },
    );
  }
  if (mediaUrls.length > CAROUSEL_MAX_ITEMS) {
    throw new InstagramPublishingError(
      `A carousel supports at most ${CAROUSEL_MAX_ITEMS} slides.`,
      { code: "INSTAGRAM_CAROUSEL_MAX_ITEMS", details: { count: mediaUrls.length } },
    );
  }

  // Step A — one unpublished child container per slide, sequential on purpose:
  // if slide N fails, abort immediately without touching Instagram again. The
  // already-created children are never referenced by a parent container, so
  // they never go live — Meta expires unused containers on its own.
  const childContainerIds: string[] = [];
  for (let i = 0; i < mediaUrls.length; i++) {
    console.log("INSTAGRAM_CAROUSEL_ITEM_CREATE", { igUserId, index: i, total: mediaUrls.length });
    const containerId = await createCarouselItemContainer(apiBase, igUserId, accessToken, mediaUrls[i]);
    console.log("INSTAGRAM_CAROUSEL_ITEM_CREATED", { containerId, index: i });
    childContainerIds.push(containerId);
  }

  // Step B — parent container referencing all children.
  const parentUrl = new URL(`${apiBase}/${igUserId}/media`);
  parentUrl.searchParams.set("access_token", accessToken);
  parentUrl.searchParams.set("media_type", "CAROUSEL");
  parentUrl.searchParams.set("children", childContainerIds.join(","));
  parentUrl.searchParams.set("caption", caption.trim());

  console.log("INSTAGRAM_CAROUSEL_CONTAINER_CREATE", { igUserId, itemCount: childContainerIds.length });

  const parentRes = await fetch(parentUrl.toString(), { method: "POST", cache: "no-store" });
  const parentPayload = await parseJson(parentRes);

  if (!parentRes.ok) {
    throw new InstagramPublishingError(
      getApiErrorMessage(parentPayload, "Instagram carousel container creation failed."),
      {
        code: classifyInstagramError(parentRes.status, parentPayload, "INSTAGRAM_CAROUSEL_CONTAINER_CREATE_FAILED"),
        details: { status: parentRes.status, childContainerIds, ...(parentPayload ?? {}) },
      },
    );
  }

  const parentContainerId = typeof parentPayload?.id === "string" ? parentPayload.id.trim() : null;
  if (!parentContainerId) {
    throw new InstagramPublishingError(
      "Instagram carousel container creation returned no ID.",
      { code: "INSTAGRAM_CAROUSEL_CONTAINER_ID_MISSING", details: { childContainerIds, ...parentPayload } },
    );
  }

  console.log("INSTAGRAM_CAROUSEL_CONTAINER_CREATED", { parentContainerId });

  // Carousel parent containers also need to reach FINISHED before publishing.
  // Labeled "carousel_parent" so logs/errors are distinguishable from the
  // FEED/REEL/STORY single-container polling below.
  await waitForVideoContainer(apiBase, parentContainerId, accessToken, "carousel_parent");

  // Step C — publish the parent container.
  const publishUrl = new URL(`${apiBase}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("creation_id", parentContainerId);
  publishUrl.searchParams.set("access_token", accessToken);

  const publishRes = await fetch(publishUrl.toString(), { method: "POST", cache: "no-store" });
  const publishPayload = await parseJson(publishRes);

  if (!publishRes.ok) {
    throw new InstagramPublishingError(
      getApiErrorMessage(publishPayload, "Instagram carousel publish failed."),
      {
        code: classifyInstagramError(publishRes.status, publishPayload, "INSTAGRAM_CAROUSEL_PUBLISH_FAILED"),
        details: { status: publishRes.status, parentContainerId, ...(publishPayload ?? {}) },
      },
    );
  }

  const mediaId = typeof publishPayload?.id === "string" ? publishPayload.id.trim() : null;
  if (!mediaId) {
    throw new InstagramPublishingError(
      "Instagram carousel publish returned no media ID.",
      { code: "INSTAGRAM_CAROUSEL_MEDIA_ID_MISSING", details: { parentContainerId, ...publishPayload } },
    );
  }

  console.log("INSTAGRAM_CAROUSEL_PUBLISH_OK", { mediaId, parentContainerId, itemCount: childContainerIds.length });
  return { externalPostId: mediaId, containerId: parentContainerId, mediaType: "CAROUSEL" };
}

// ---------------------------------------------------------------------------
// Public API — unified content publisher (Feed / Reel / Story / Carousel)
// ---------------------------------------------------------------------------

export async function publishInstagramContent(
  input: InstagramPublishInput,
): Promise<InstagramPublishResult> {
  const { accessToken, igUserId, apiBase, contentType } = input;
  const caption = truncateCaption(input.caption.trim());

  if (contentType === "CAROUSEL") {
    return publishInstagramCarousel({
      accessToken,
      igUserId,
      apiBase,
      caption,
      mediaUrls: input.mediaUrls ?? [],
    });
  }

  const mediaUrl = input.mediaUrl ?? "";
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
        code: classifyInstagramError(containerRes.status, containerPayload, "INSTAGRAM_CONTAINER_CREATE_FAILED"),
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
        code: classifyInstagramError(publishRes.status, publishPayload, "INSTAGRAM_PUBLISH_FAILED"),
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
// Public API — Facebook Page publisher (influencer + empresa)
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
  const accountType =
    typeof authMeta.accountType === "string" ? authMeta.accountType : null;

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

  return { accessToken, igUserId, authType, apiBase, accountType };
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
