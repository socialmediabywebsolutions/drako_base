import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireCurrentSocialFlowSession = vi.fn();
const mockSaveRuntimePost = vi.fn();
const mockPublishRuntimePostLive = vi.fn();
const mockGetRuntimePostById = vi.fn();
const mockListRuntimeSocialAccountsFromDb = vi.fn();
const mockValidateRuntimeLinkedInAccount = vi.fn();
const mockIsEncryptedToken = vi.fn();
const mockIsRuntimeTenantAllowedInPrivatePilot = vi.fn();
const mockLogRuntimeEvent = vi.fn();

const TestLinkedInIntegrationError = vi.hoisted(() => class TestLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: "INVALID_CREDENTIALS" | "PENDING";

  constructor(message: string, opts: { code: string; accountStatus: "INVALID_CREDENTIALS" | "PENDING" }) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
  }
});

vi.mock("../../../../lib/auth/session", () => ({
  requireCurrentSocialFlowSession: (...args: unknown[]) => mockRequireCurrentSocialFlowSession(...args),
}));

vi.mock("../../../../lib/runtime-observability", () => ({
  addRuntimeHeaders: (response: Response) => response,
  getRuntimeCorrelationId: () => "test-correlation",
  logRuntimeEvent: (...args: unknown[]) => mockLogRuntimeEvent(...args),
}));

vi.mock("../../../../lib/socialflow/posts-service", () => ({
  approveRuntimePost: vi.fn(),
  getRuntimePostById: (...args: unknown[]) => mockGetRuntimePostById(...args),
  listRuntimePosts: vi.fn(),
  markRuntimePostAsPosted: vi.fn(),
  publishRuntimePostLive: (...args: unknown[]) => mockPublishRuntimePostLive(...args),
  rejectRuntimePost: vi.fn(),
  saveRuntimePost: (...args: unknown[]) => mockSaveRuntimePost(...args),
  scheduleRuntimePost: vi.fn(),
  SocialContextError: class SocialContextError extends Error {},
}));

vi.mock("../../../../lib/socialflow/posts-repository", () => ({
  listRuntimeSocialAccountsFromDb: (...args: unknown[]) => mockListRuntimeSocialAccountsFromDb(...args),
}));

vi.mock("../../../../lib/socialflow/linkedin/publishing", () => ({
  validateRuntimeLinkedInAccount: (...args: unknown[]) => mockValidateRuntimeLinkedInAccount(...args),
}));

vi.mock("../../../../lib/socialflow/token-encryption", () => ({
  isEncryptedToken: (...args: unknown[]) => mockIsEncryptedToken(...args),
}));

vi.mock("../../../../lib/socialflow/private-pilot", () => ({
  isRuntimeTenantAllowedInPrivatePilot: (...args: unknown[]) => mockIsRuntimeTenantAllowedInPrivatePilot(...args),
}));

vi.mock("../../../../lib/socialflow/linkedin/core", () => ({
  LinkedInIntegrationError: TestLinkedInIntegrationError,
}));

import { POST } from "./route";

function buildRequest(body: Record<string, unknown>) {
  return new Request("https://socialflow-canary.drako.systems/api/socialflow/posts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildBody(patch?: Record<string, unknown>) {
  return {
    saasId: "socialflow",
    content: "runtime post",
    ...patch,
  };
}

describe("runtime /api/socialflow/posts POST publish guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCurrentSocialFlowSession.mockResolvedValue({
      tenantId: "tenant-socialflow",
      role: "admin",
      userId: "u1",
      email: "staff@drako.systems",
    });
    mockSaveRuntimePost.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-socialflow",
      saasId: "socialflow",
      campaignId: null,
      channelId: "ch-1",
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "runtime post",
      body: "runtime post",
      imageHint: null,
      status: "DRAFT",
      scheduledAt: null,
      postedAt: null,
      externalPostId: null,
      metadata: null,
      createdAt: "2026-05-21T10:00:00.000Z",
      updatedAt: "2026-05-21T10:00:00.000Z",
    });
    mockListRuntimeSocialAccountsFromDb.mockResolvedValue([
      {
        id: "acc-1",
        tenantId: "tenant-socialflow",
        saasId: "socialflow",
        provider: "LINKEDIN",
        handle: "socialflow-linkedin",
        displayName: "SocialFlow LinkedIn",
        status: "CONNECTED_REAL",
        authMeta: {
          accessToken: "encrypted:v1:aes-gcm:iv:cipher",
          idToken: "encrypted:v1:aes-gcm:iv:id-cipher",
          lastErrorCode: null,
        },
        isPrimary: true,
        createdAt: "2026-05-21T10:00:00.000Z",
        updatedAt: "2026-05-21T10:00:00.000Z",
      },
    ]);
    mockValidateRuntimeLinkedInAccount.mockResolvedValue({ profileId: "profile-1" });
    mockIsEncryptedToken.mockReturnValue(true);
    mockIsRuntimeTenantAllowedInPrivatePilot.mockReturnValue(true);
    mockPublishRuntimePostLive.mockResolvedValue({
      ok: true,
      code: "PUBLISHED_LIVE_LINKEDIN",
      message: "Post published live.",
      externalPostId: "ext-1",
      post: { id: "post-1" },
    });
    mockGetRuntimePostById.mockResolvedValue({ id: "post-1" });
  });

  it("does not publish when confirmPublish is omitted", async () => {
    const response = await POST(buildRequest(buildBody()));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(body.livePublish?.code).toBe("PUBLISH_CONFIRMATION_REQUIRED");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("does not publish when confirmPublish is false", async () => {
    const response = await POST(buildRequest(buildBody({ confirmPublish: false })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(body.livePublish?.code).toBe("PUBLISH_CONFIRMATION_REQUIRED");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("blocks publish for non-admin role", async () => {
    mockRequireCurrentSocialFlowSession.mockResolvedValue({
      tenantId: "tenant-socialflow",
      role: "user",
      userId: "u1",
      email: "user@drako.systems",
    });

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(403);
    expect(body.livePublish?.code).toBe("PUBLISH_ROLE_NOT_AUTHORIZED");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when tenant is not allowlisted in private pilot mode", async () => {
    mockIsRuntimeTenantAllowedInPrivatePilot.mockReturnValue(false);

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(403);
    expect(body.livePublish?.code).toBe("PRIVATE_PILOT_TENANT_NOT_ALLOWED");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when LinkedIn account has unresolved lastErrorCode", async () => {
    mockListRuntimeSocialAccountsFromDb.mockResolvedValue([
      {
        id: "acc-1",
        tenantId: "tenant-socialflow",
        saasId: "socialflow",
        provider: "LINKEDIN",
        handle: "socialflow-linkedin",
        displayName: "SocialFlow LinkedIn",
        status: "CONNECTED_REAL",
        authMeta: {
          accessToken: "encrypted:v1:aes-gcm:iv:cipher",
          idToken: "encrypted:v1:aes-gcm:iv:id-cipher",
          lastErrorCode: "LINKEDIN_PROFILE_FETCH_FAILED",
        },
        isPrimary: true,
        createdAt: "2026-05-21T10:00:00.000Z",
        updatedAt: "2026-05-21T10:00:00.000Z",
      },
    ]);

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(409);
    expect(body.livePublish?.code).toBe("LINKEDIN_LAST_VALIDATION_ERROR");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when LinkedIn tokens are not encrypted", async () => {
    mockIsEncryptedToken.mockImplementation((token: string | null) => token === "encrypted:v1:aes-gcm:iv:id-cipher");

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(409);
    expect(body.livePublish?.code).toBe("LINKEDIN_TOKENS_NOT_ENCRYPTED");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when post scope mismatches tenant/saas", async () => {
    mockSaveRuntimePost.mockResolvedValue({
      id: "post-1",
      tenantId: "tenant-socialflow",
      saasId: "other-saas",
      provider: "LINKEDIN",
      contentType: "FEED",
      title: "runtime post",
      body: "runtime post",
      status: "DRAFT",
      scheduledAt: null,
    });

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(409);
    expect(body.livePublish?.code).toBe("POST_SCOPE_MISMATCH");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("blocks publish when pre-publish validation fails", async () => {
    mockValidateRuntimeLinkedInAccount.mockRejectedValue(
      new TestLinkedInIntegrationError("forbidden", {
        code: "LINKEDIN_PROFILE_FETCH_FAILED",
        accountStatus: "INVALID_CREDENTIALS",
      }),
    );

    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(409);
    expect(body.livePublish?.code).toBe("LINKEDIN_PROFILE_FETCH_FAILED");
    expect(mockPublishRuntimePostLive).not.toHaveBeenCalled();
  });

  it("allows ready-to-publish flow when confirmPublish=true and checks pass", async () => {
    const response = await POST(buildRequest(buildBody({ confirmPublish: true })));
    const body = await response.json() as Record<string, any>;

    expect(response.status).toBe(200);
    expect(mockValidateRuntimeLinkedInAccount).toHaveBeenCalledTimes(1);
    expect(mockPublishRuntimePostLive).toHaveBeenCalledTimes(1);
    expect(body.livePublish?.ok).toBe(true);
    expect(body.livePublish?.code).toBe("PUBLISHED_LIVE_LINKEDIN");
  });
});
