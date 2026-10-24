// Threads API primitivas canónicas — sin efectos secundarios, sin DB, sin sesión.
// Todos los errores lanzan ThreadsIntegrationError con códigos estables.

import {
  SOCIALFLOW_THREADS_API_BASE,
  SOCIALFLOW_THREADS_EXCHANGE_URL,
  SOCIALFLOW_THREADS_TOKEN_URL,
  ThreadsIntegrationError,
  type ThreadsCreationResponse,
  type ThreadsLongLivedTokenResponse,
  type ThreadsMediaType,
  type ThreadsPublishResponse,
  type ThreadsTokenResponse,
  type ThreadsUserProfile,
} from "@/lib/socialflow/threads/types";

// ---------------------------------------------------------------------------
// Token exchange
// ---------------------------------------------------------------------------

/**
 * Exchanges a short-lived authorization code for a short-lived access token (1h).
 * Then immediately exchanges it for a long-lived token (60 days).
 */
export async function exchangeThreadsCodeForLongLivedToken(params: {
  code: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<ThreadsLongLivedTokenResponse> {
  // Step 1: short-lived token
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
    code: params.code,
  });

  const shortRes = await fetch(SOCIALFLOW_THREADS_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!shortRes.ok) {
    const errText = await shortRes.text().catch(() => "");
    throw new ThreadsIntegrationError(
      `Threads token exchange failed: HTTP ${shortRes.status}`,
      { code: "THREADS_TOKEN_EXCHANGE_FAILED", details: { status: shortRes.status, body: errText } },
    );
  }

  const shortToken = (await shortRes.json()) as ThreadsTokenResponse;
  if (!shortToken.access_token) {
    throw new ThreadsIntegrationError("Threads token exchange returned no access_token", {
      code: "THREADS_TOKEN_MISSING",
    });
  }

  // Step 2: exchange for long-lived token (60 days)
  const exchangeUrl = new URL(SOCIALFLOW_THREADS_EXCHANGE_URL);
  exchangeUrl.searchParams.set("grant_type", "th_exchange_token");
  exchangeUrl.searchParams.set("client_secret", params.clientSecret);
  exchangeUrl.searchParams.set("access_token", shortToken.access_token);

  const longRes = await fetch(exchangeUrl.toString());
  if (!longRes.ok) {
    const errText = await longRes.text().catch(() => "");
    throw new ThreadsIntegrationError(
      `Threads long-lived token exchange failed: HTTP ${longRes.status}`,
      { code: "THREADS_LONG_TOKEN_EXCHANGE_FAILED", details: { status: longRes.status, body: errText } },
    );
  }

  const longToken = (await longRes.json()) as ThreadsLongLivedTokenResponse;
  if (!longToken.access_token) {
    throw new ThreadsIntegrationError("Threads long-lived token exchange returned no access_token", {
      code: "THREADS_LONG_TOKEN_MISSING",
    });
  }

  return longToken;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function fetchThreadsUserProfile(accessToken: string): Promise<ThreadsUserProfile> {
  const url = new URL(`${SOCIALFLOW_THREADS_API_BASE}/me`);
  url.searchParams.set("fields", "id,username,name");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new ThreadsIntegrationError(
      `Threads profile fetch failed: HTTP ${res.status}`,
      { code: "THREADS_PROFILE_FETCH_FAILED", details: { status: res.status, body: errText } },
    );
  }

  const data = (await res.json()) as Partial<ThreadsUserProfile>;
  if (!data.id || !data.username) {
    throw new ThreadsIntegrationError("Threads profile missing id or username", {
      code: "THREADS_PROFILE_MISSING_FIELDS",
      details: { received: JSON.stringify(data).slice(0, 200) },
    });
  }

  return { id: data.id, username: data.username, name: data.name };
}

// ---------------------------------------------------------------------------
// Publishing (two-step: create container → publish)
// ---------------------------------------------------------------------------

/**
 * Step 1: Create a Threads media container.
 * Returns the creation_id to pass to publishThreadsContainer().
 */
export async function createThreadsContainer(params: {
  userId: string;
  accessToken: string;
  text: string;
  mediaType: ThreadsMediaType;
  mediaUrl?: string | null; // required for IMAGE and VIDEO
}): Promise<ThreadsCreationResponse> {
  const url = new URL(`${SOCIALFLOW_THREADS_API_BASE}/${params.userId}/threads`);
  url.searchParams.set("access_token", params.accessToken);
  url.searchParams.set("media_type", params.mediaType);
  url.searchParams.set("text", params.text);

  if ((params.mediaType === "IMAGE" || params.mediaType === "VIDEO") && params.mediaUrl) {
    const key = params.mediaType === "IMAGE" ? "image_url" : "video_url";
    url.searchParams.set(key, params.mediaUrl);
  }

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let errData: Record<string, unknown> = {};
    try { errData = JSON.parse(errText); } catch { /* ignore */ }

    const errCode = typeof errData?.error === "object" ? String((errData.error as Record<string, unknown>)?.code ?? "") : "";
    const errMsg = typeof errData?.error === "object" ? String((errData.error as Record<string, unknown>)?.message ?? errText) : errText;

    if (res.status === 401) {
      throw new ThreadsIntegrationError(`Threads token invalid or expired: ${errMsg}`, {
        code: "THREADS_TOKEN_INVALID",
        details: { status: res.status, errCode, errMsg },
      });
    }
    if (res.status === 429) {
      throw new ThreadsIntegrationError("Threads rate limit exceeded", {
        code: "THREADS_RATE_LIMITED",
        details: { status: res.status },
      });
    }
    throw new ThreadsIntegrationError(`Threads container creation failed: ${errMsg}`, {
      code: "THREADS_CONTAINER_FAILED",
      details: { status: res.status, errCode, errMsg },
    });
  }

  const data = (await res.json()) as Partial<ThreadsCreationResponse>;
  if (!data.id) {
    throw new ThreadsIntegrationError("Threads container creation returned no id", {
      code: "THREADS_CONTAINER_ID_MISSING",
    });
  }
  return { id: data.id };
}

/**
 * Step 2: Publish a previously created container.
 * Returns the permanent post ID.
 */
export async function publishThreadsContainer(params: {
  userId: string;
  accessToken: string;
  creationId: string;
}): Promise<ThreadsPublishResponse> {
  const url = new URL(`${SOCIALFLOW_THREADS_API_BASE}/${params.userId}/threads_publish`);
  url.searchParams.set("access_token", params.accessToken);
  url.searchParams.set("creation_id", params.creationId);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let errData: Record<string, unknown> = {};
    try { errData = JSON.parse(errText); } catch { /* ignore */ }
    const errMsg = typeof errData?.error === "object" ? String((errData.error as Record<string, unknown>)?.message ?? errText) : errText;

    if (res.status === 401) {
      throw new ThreadsIntegrationError(`Threads token invalid during publish: ${errMsg}`, {
        code: "THREADS_PUBLISH_TOKEN_INVALID",
        details: { status: res.status },
      });
    }
    if (res.status === 429) {
      throw new ThreadsIntegrationError("Threads rate limit exceeded during publish", {
        code: "THREADS_PUBLISH_RATE_LIMITED",
        details: { status: res.status },
      });
    }
    throw new ThreadsIntegrationError(`Threads publish failed: ${errMsg}`, {
      code: "THREADS_PUBLISH_FAILED",
      details: { status: res.status, errMsg },
    });
  }

  const data = (await res.json()) as Partial<ThreadsPublishResponse>;
  if (!data.id) {
    throw new ThreadsIntegrationError("Threads publish returned no post id", {
      code: "THREADS_PUBLISH_ID_MISSING",
    });
  }
  return { id: data.id };
}
