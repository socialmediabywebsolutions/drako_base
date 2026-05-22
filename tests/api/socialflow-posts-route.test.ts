import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCurrentSocialFlowSession = vi.hoisted(() => vi.fn());
const resolveSocialContext = vi.hoisted(() => vi.fn());
const upsertSaasSocialPost = vi.hoisted(() => vi.fn());
const listSaasSocialAccounts = vi.hoisted(() => vi.fn());
const publishSocialPostLive = vi.hoisted(() => vi.fn());
const getSaasSocialPostById = vi.hoisted(() => vi.fn());
const validateAccount = vi.hoisted(() => vi.fn());
const isEncryptedToken = vi.hoisted(() => vi.fn());
const isTenantAllowedInPrivatePilot = vi.hoisted(() => vi.fn());

const MockLinkedInIntegrationError = vi.hoisted(() => class MockLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: "INVALID_CREDENTIALS" | "PENDING";

  constructor(message: string, opts: { code: string; accountStatus: "INVALID_CREDENTIALS" | "PENDING" }) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
  }
});

vi.mock("@/lib/socialflow/auth/request", () => ({
  requireCurrentSocialFlowSession,
}));

vi.mock("@/lib/socialflow/repository", () => ({
  approvePost: vi.fn(),
  getSaasSocialPostById,
  listSaasSocialPosts: vi.fn(),
  markAsPosted: vi.fn(),
  rejectPost: vi.fn(),
  resolveSocialContext,
  runSocialSchedulerSimulation: vi.fn(),
  schedulePost: vi.fn(),
  SocialContextError: class SocialContextError extends Error {},
  upsertSaasSocialPost,
  listSaasSocialAccounts,
}));

vi.mock("@/lib/socialflow/live-publishing", () => ({
  publishSocialPostLive,
}));

vi.mock("@/lib/socialflow/linkedin/publishing", () => ({
  validateAccount,
}));

vi.mock("@/lib/socialflow/token-encryption", () => ({
  isEncryptedToken,
}));

vi.mock("@/lib/socialflow/private-pilot", () => ({
  isTenantAllowedInPrivatePilot,
}));

vi.mock("@/lib/socialflow/linkedin/core", () => ({
  LinkedInIntegrationError: MockLinkedInIntegrationError,
}));

import { POST } from "@/app/api/socialflow/posts/route";

function buildBody(patch?: Record<string, unknown>) {
  return {
    saasId: "socialflow",
    content: "hello linkedin",
    ...patch,
  };
}

function buildRequest(body: Record<string, unknown>) {
  return new Request("https://socialflow.drako.systems/api/socialflow/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/socialflow/posts POST publish confirmation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSocialFlowSession.mockResolvedValue({
      tenantId: "tenant-socialflow",
      role: "admin",
      userId: "u1",
      email: "staff@drako.systems",
    });
    resolveSocialContext.mockResolvedValue({
      tenantId: "tenant-socialflow",
      saasId: "socialflow",
      socialDb: {},
    });
    upsertSaasSocialPost.mockResolvedValue({
      id: "post-1",
      saasId: "socialflow",
      campaignId: null,
      channelId: "ch-1",
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "hello linkedin",
      body: "hello linkedin",
      imageHint: null,
      status: "DRAFT",
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      tenantId: "tenant-socialflow",
      createdAt: "2026-05-18T10:00:00.000Z",
      updatedAt: "2026-05-18T10:00:00.000Z",
    });
    listSaasSocialAccounts.mockResolvedValue([
      {
        id: "acc-1",
        provider: "LINKEDIN",
        isPrimary: true,
        status: "CONNECTED_REAL",
        authMeta: {
          accessToken: "encrypted:v1:aes-gcm:iv:cipher",
          idToken: "encrypted:v1:aes-gcm:iv:id-cipher",
          lastErrorCode: null,
        },
      },
    ]);
    validateAccount.mockResolvedValue({ profileId: "profile-1" });
    isEncryptedToken.mockReturnValue(true);
    isTenantAllowedInPrivatePilot.mockReturnValue(true);
    publishSocialPostLive.mockResolvedValue({
      ok: true,
      code: "PUBLISHED_LIVE_LINKEDIN",
      message: "Post published live.",
      externalPostId: "ext-1",
      post: { id: "post-1" },
    });
    getSaasSocialPostById.mockResolvedValue({ id: "post-1" });
  });

  it("does not publish when confirmPublish is omitted", async () => {
    const response = await POST(buildRequest(buildBody()));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(body.livePublish?.code).toBe("PUBLISH_CONFIRMATION_REQUIRED");
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("does not publish when confirmPublish is false", async () => {
    const response = await POST(buildRequest(buildBody({ confirmPublish: false })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(body.livePublish?.code).toBe("PUBLISH_CONFIRMATION_REQUIRED");
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("requires pre-publish linkedin validation when confirmPublish is true", async () => {
    validateAccount.mockRejectedValue(
      new MockLinkedInIntegrationError("forbidden", {
        code: "LINKEDIN_PROFILE_FETCH_FAILED",
        accountStatus: "INVALID_CREDENTIALS",
      }),
    );

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(409);
    expect(body.livePublish?.code).toBe("LINKEDIN_PROFILE_FETCH_FAILED");
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("publishes when confirmPublish=true and validation succeeds", async () => {
    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(validateAccount).toHaveBeenCalled();
    expect(publishSocialPostLive).toHaveBeenCalledTimes(1);
    expect(body.livePublish?.ok).toBe(true);
  });

  it("keeps scheduled posts without forcing live publish", async () => {
    const response = await POST(buildRequest(buildBody({
      confirmPublish: true,
      scheduledAt: "2026-06-01T10:00:00.000Z",
      status: "SCHEDULED",
    })));

    expect(response.status).toBe(200);
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("blocks publish for non-admin role", async () => {
    requireCurrentSocialFlowSession.mockResolvedValue({
      tenantId: "tenant-socialflow",
      role: "user",
      userId: "u1",
      email: "user@drako.systems",
    });

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(403);
    expect(body.livePublish?.code).toBe("PUBLISH_ROLE_NOT_AUTHORIZED");
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when tenant is not allowlisted in private pilot mode", async () => {
    isTenantAllowedInPrivatePilot.mockReturnValue(false);

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(403);
    expect(body.livePublish?.code).toBe("PRIVATE_PILOT_TENANT_NOT_ALLOWED");
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when LinkedIn account has unresolved lastErrorCode", async () => {
    listSaasSocialAccounts.mockResolvedValue([
      {
        id: "acc-1",
        provider: "LINKEDIN",
        isPrimary: true,
        status: "CONNECTED_REAL",
        authMeta: {
          accessToken: "encrypted:v1:aes-gcm:iv:cipher",
          idToken: "encrypted:v1:aes-gcm:iv:id-cipher",
          lastErrorCode: "LINKEDIN_PROFILE_FETCH_FAILED",
        },
      },
    ]);

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(409);
    expect(body.livePublish?.code).toBe("LINKEDIN_LAST_VALIDATION_ERROR");
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when LinkedIn tokens are not encrypted", async () => {
    isEncryptedToken.mockImplementation((value: string | null) => value === "encrypted:v1:aes-gcm:iv:id-cipher");

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(409);
    expect(body.livePublish?.code).toBe("LINKEDIN_TOKENS_NOT_ENCRYPTED");
    expect(publishSocialPostLive).not.toHaveBeenCalled();
  });
});
