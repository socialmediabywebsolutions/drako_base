export class LinkedInIntegrationError extends Error {
  code: string;
  accountStatus: "PENDING_REAL" | "INVALID_CREDENTIALS" | "NEEDS_RECONNECTION";
  httpStatus: number;

  constructor(
    message: string,
    options: {
      code: string;
      accountStatus: "PENDING_REAL" | "INVALID_CREDENTIALS" | "NEEDS_RECONNECTION";
      httpStatus?: number;
    },
  ) {
    super(message);
    this.name = "LinkedInIntegrationError";
    this.code = options.code;
    this.accountStatus = options.accountStatus;
    this.httpStatus = options.httpStatus ?? 502;
  }
}

type LinkedInProfile = {
  id?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
};

function buildAuthHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
    "LinkedIn-Version": "202603",
  };
}

async function parseLinkedInError(response: Response): Promise<string> {
  const fallback = `LinkedIn request failed with ${response.status}`;
  try {
    const payload = (await response.json()) as { message?: string; error_description?: string };
    return payload.message ?? payload.error_description ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeLinkedInPostUrn(externalPostId: string): string {
  const normalized = externalPostId.trim();
  if (normalized.startsWith("urn:li:")) return normalized;
  if (normalized.startsWith("ugcPost:")) return `urn:li:${normalized}`;
  if (normalized.startsWith("share:")) return `urn:li:${normalized}`;
  return `urn:li:ugcPost:${normalized}`;
}

function readNumberCandidate(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pickFirstNumber(...values: unknown[]): number {
  for (const value of values) {
    const candidate = readNumberCandidate(value);
    if (candidate != null) return candidate;
  }
  return 0;
}

export async function verifyLinkedInAccess(accessToken: string): Promise<{
  authorUrn: string;
  displayName: string;
  profileId: string;
}> {
  const response = await fetch("https://api.linkedin.com/v2/me", {
    method: "GET",
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    const message = await parseLinkedInError(response);
    if (response.status === 401 || response.status === 403) {
      throw new LinkedInIntegrationError(message, {
        code: "LINKEDIN_INVALID_CREDENTIALS",
        accountStatus: "INVALID_CREDENTIALS",
        httpStatus: response.status,
      });
    }
    throw new LinkedInIntegrationError(message, {
      code: "LINKEDIN_CONNECTION_PENDING",
      accountStatus: "PENDING_REAL",
      httpStatus: response.status,
    });
  }

  const payload = (await response.json()) as LinkedInProfile;
  if (!payload.id) {
    throw new LinkedInIntegrationError("LinkedIn profile response did not include an id.", {
      code: "LINKEDIN_PROFILE_INCOMPLETE",
      accountStatus: "PENDING_REAL",
    });
  }

  const displayName = [payload.localizedFirstName, payload.localizedLastName].filter(Boolean).join(" ").trim() || "LinkedIn member";
  return {
    authorUrn: `urn:li:person:${payload.id}`,
    displayName,
    profileId: payload.id,
  };
}

export async function publishLinkedInTextPost(input: {
  accessToken: string;
  authorUrn: string;
  text: string;
}): Promise<{
  externalPostId: string | null;
  publishedAt: string;
}> {
  const publishedAt = new Date().toISOString();
  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: buildAuthHeaders(input.accessToken),
    body: JSON.stringify({
      author: input.authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: input.text,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    }),
  });

  if (!response.ok) {
    const message = await parseLinkedInError(response);
    if (response.status === 401 || response.status === 403) {
      throw new LinkedInIntegrationError(message, {
        code: "LINKEDIN_REAUTH_REQUIRED",
        accountStatus: "NEEDS_RECONNECTION",
        httpStatus: response.status,
      });
    }
    throw new LinkedInIntegrationError(message, {
      code: "LINKEDIN_PUBLISH_FAILED",
      accountStatus: "PENDING_REAL",
      httpStatus: response.status,
    });
  }

  const payload = (await response.json().catch(() => ({}))) as { id?: string };
  const externalPostId = payload.id ?? response.headers.get("x-restli-id") ?? null;
  return {
    externalPostId,
    publishedAt,
  };
}

export async function getLinkedInPostAnalytics(
  externalPostId: string,
  accessToken: string,
): Promise<{
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  lastFetchedAt: string;
}> {
  const postUrn = normalizeLinkedInPostUrn(externalPostId);
  const lastFetchedAt = new Date().toISOString();

  const [socialActionsResponse, analyticsResponse] = await Promise.all([
    fetch(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}`, {
      method: "GET",
      headers: buildAuthHeaders(accessToken),
    }),
    fetch(`https://api.linkedin.com/rest/memberCreatorPostAnalytics?q=entity&entity=${encodeURIComponent(postUrn)}`, {
      method: "GET",
      headers: buildAuthHeaders(accessToken),
    }).catch(() => null),
  ]);

  if (!socialActionsResponse.ok) {
    const message = await parseLinkedInError(socialActionsResponse);
    throw new LinkedInIntegrationError(message, {
      code: socialActionsResponse.status === 401 || socialActionsResponse.status === 403
        ? "LINKEDIN_ANALYTICS_REAUTH_REQUIRED"
        : "LINKEDIN_ANALYTICS_UNAVAILABLE",
      accountStatus: socialActionsResponse.status === 401 || socialActionsResponse.status === 403 ? "NEEDS_RECONNECTION" : "PENDING_REAL",
      httpStatus: socialActionsResponse.status,
    });
  }

  const socialActionsPayload = (await socialActionsResponse.json().catch(() => ({}))) as Record<string, unknown>;
  const analyticsPayload = analyticsResponse?.ok
    ? (await analyticsResponse.json().catch(() => ({}))) as Record<string, unknown>
    : {};
  const analyticsElements = Array.isArray(analyticsPayload.elements) ? analyticsPayload.elements : [];
  const firstAnalytics = analyticsElements[0] as Record<string, unknown> | undefined;
  const totalShareStatistics = firstAnalytics?.totalShareStatistics as Record<string, unknown> | undefined;

  return {
    impressions: pickFirstNumber(
      totalShareStatistics?.impressionCount,
      firstAnalytics?.impressionCount,
      socialActionsPayload.impressionCount,
      socialActionsPayload.impressions,
    ),
    likes: pickFirstNumber(
      (socialActionsPayload.likesSummary as Record<string, unknown> | undefined)?.aggregatedTotalLikes,
      (socialActionsPayload.likesSummary as Record<string, unknown> | undefined)?.totalLikes,
      socialActionsPayload.numLikes,
      socialActionsPayload.likeCount,
    ),
    comments: pickFirstNumber(
      (socialActionsPayload.commentsSummary as Record<string, unknown> | undefined)?.aggregatedTotalComments,
      (socialActionsPayload.commentsSummary as Record<string, unknown> | undefined)?.totalFirstLevelComments,
      socialActionsPayload.numComments,
      socialActionsPayload.commentCount,
    ),
    shares: pickFirstNumber(
      totalShareStatistics?.shareCount,
      (socialActionsPayload.sharesSummary as Record<string, unknown> | undefined)?.aggregatedTotalShares,
      socialActionsPayload.numShares,
      socialActionsPayload.shareCount,
    ),
    lastFetchedAt,
  };
}
