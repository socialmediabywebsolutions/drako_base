import { decryptToken } from "@/lib/socialflow/token-encryption";
import type { SaasSocialAccount } from "@/lib/social-core/types";

const META_GRAPH_VERSION = "v19.0";
const META_GRAPH_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

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

// ---------------------------------------------------------------------------
// Public API — Instagram Content Publishing (two-step: container → publish)
// ---------------------------------------------------------------------------

export type InstagramPublishInput = {
  pageToken: string;
  igUserId: string;
  caption: string;
  imageUrl?: string | null;
};

export type InstagramPublishResult = {
  externalPostId: string;
  containerId: string;
};

export async function publishInstagramPost(
  input: InstagramPublishInput,
): Promise<InstagramPublishResult> {
  const { pageToken, igUserId, caption } = input;
  const imageUrl = input.imageUrl?.trim() || null;

  if (!imageUrl || !imageUrl.startsWith("http")) {
    throw new InstagramPublishingError(
      "Instagram publishing requires a public image URL. Set the imageHint field to a publicly accessible HTTPS URL.",
      { code: "INSTAGRAM_IMAGE_REQUIRED" },
    );
  }

  // Step 1 — Create media container
  const containerUrl = new URL(`${META_GRAPH_BASE_URL}/${igUserId}/media`);
  containerUrl.searchParams.set("image_url", imageUrl);
  containerUrl.searchParams.set("caption", caption.trim());
  containerUrl.searchParams.set("access_token", pageToken);

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

  // Step 2 — Publish the container
  const publishUrl = new URL(`${META_GRAPH_BASE_URL}/${igUserId}/media_publish`);
  publishUrl.searchParams.set("creation_id", containerId);
  publishUrl.searchParams.set("access_token", pageToken);

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

  return { externalPostId: mediaId, containerId };
}

// ---------------------------------------------------------------------------
// Public API — Token extraction helper
// ---------------------------------------------------------------------------

export async function requireInstagramPageToken(
  account: SaasSocialAccount,
): Promise<{ pageToken: string; igUserId: string }> {
  const authMeta = (account.authMeta ?? {}) as Record<string, unknown>;
  const encryptedToken =
    typeof authMeta.accessToken === "string" ? authMeta.accessToken.trim() : "";
  const igUserId =
    typeof authMeta.igUserId === "string" ? authMeta.igUserId.trim() : "";

  if (!encryptedToken) {
    throw new InstagramPublishingError(
      "Instagram page access token is missing from account credentials.",
      { code: "INSTAGRAM_ACCESS_TOKEN_MISSING" },
    );
  }
  if (!igUserId) {
    throw new InstagramPublishingError(
      "Instagram user ID (igUserId) is missing from account credentials.",
      { code: "INSTAGRAM_USER_ID_MISSING" },
    );
  }

  const pageToken = await decryptToken(encryptedToken);
  if (!pageToken) {
    throw new InstagramPublishingError(
      "Instagram access token decryption failed.",
      { code: "INSTAGRAM_ACCESS_TOKEN_DECRYPTION_FAILED" },
    );
  }

  return { pageToken, igUserId };
}
