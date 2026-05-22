import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindPrimaryRuntimeLinkedInAccount = vi.hoisted(() => vi.fn());
const mockGetRuntimePostByIdFromDb = vi.hoisted(() => vi.fn());
const mockMarkRuntimePostAsPostedInDb = vi.hoisted(() => vi.fn());
const mockUpdateRuntimePostStatusInDb = vi.hoisted(() => vi.fn());
const mockUpsertRuntimePostInDb = vi.hoisted(() => vi.fn());
const mockClaimRuntimeScheduledPostForPublishing = vi.hoisted(() => vi.fn());
const mockBuildRuntimeLinkedInPublishResult = vi.hoisted(() => vi.fn());

const TestLinkedInIntegrationError = vi.hoisted(() => class TestLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: "INVALID_CREDENTIALS" | "PENDING";
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: {
      code: string;
      accountStatus: "INVALID_CREDENTIALS" | "PENDING";
      details?: Record<string, unknown> | null;
    },
  ) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
    this.details = opts.details ?? null;
  }
});

vi.mock("./posts-repository", () => ({
  findPrimaryRuntimeLinkedInAccount: (...args: unknown[]) => mockFindPrimaryRuntimeLinkedInAccount(...args),
  getRuntimePostByIdFromDb: (...args: unknown[]) => mockGetRuntimePostByIdFromDb(...args),
  markRuntimePostAsPostedInDb: (...args: unknown[]) => mockMarkRuntimePostAsPostedInDb(...args),
  updateRuntimePostStatusInDb: (...args: unknown[]) => mockUpdateRuntimePostStatusInDb(...args),
  upsertRuntimePostInDb: (...args: unknown[]) => mockUpsertRuntimePostInDb(...args),
  claimRuntimeScheduledPostForPublishing: (...args: unknown[]) => mockClaimRuntimeScheduledPostForPublishing(...args),
  SocialContextError: class SocialContextError extends Error {},
}));

vi.mock("./linkedin-service", () => ({
  buildRuntimeLinkedInPublishResult: (...args: unknown[]) => mockBuildRuntimeLinkedInPublishResult(...args),
}));

vi.mock("./linkedin/core", () => ({
  LinkedInIntegrationError: TestLinkedInIntegrationError,
}));

vi.mock("./runtime-repository-core", () => ({
  nowIso: () => "2026-05-21T16:00:00.000Z",
  mergeJsonRecord: (base: Record<string, unknown> | null | undefined, patch: Record<string, unknown>) => ({
    ...(base ?? {}),
    ...patch,
  }),
}));

import { publishRuntimePostLive } from "./live-publishing-service";

function basePost() {
  return {
    id: "post-1",
    tenantId: "tenant_socialflow_canary_staff",
    saasId: "p2-24i-saas",
    channelId: "ch-1",
    campaignId: "camp-1",
    provider: "LINKEDIN",
    contentType: "FEED",
    title: "title",
    body: "body",
    imageHint: null,
    status: "DRAFT",
    scheduledAt: null,
    postedAt: null,
    externalPostId: null,
    metadata: null,
    createdAt: "2026-05-21T15:00:00.000Z",
    updatedAt: "2026-05-21T15:00:00.000Z",
  };
}

describe("runtime live publish safe error capture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindPrimaryRuntimeLinkedInAccount.mockResolvedValue({
      id: "acc-1",
      tenantId: "tenant_socialflow_canary_staff",
      saasId: "p2-24i-saas",
      provider: "LINKEDIN",
      handle: "staff",
      displayName: "Staff",
      status: "CONNECTED_REAL",
      authMeta: {
        accessToken: "encrypted:v1:aes-gcm:iv:cipher",
        authorUrn: "urn:li:person:abc",
        scope: "openid profile email w_member_social",
      },
      isPrimary: true,
      createdAt: "2026-05-21T15:00:00.000Z",
      updatedAt: "2026-05-21T15:00:00.000Z",
    });

    const initial = basePost();
    const failed = { ...basePost(), status: "FAILED" };
    mockGetRuntimePostByIdFromDb
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(failed);

    mockUpsertRuntimePostInDb.mockImplementation(async ({ tenantId, post }: any) => ({
      tenantId,
      ...post,
      createdAt: "2026-05-21T15:00:00.000Z",
      updatedAt: "2026-05-21T16:00:00.000Z",
    }));
    mockUpdateRuntimePostStatusInDb.mockResolvedValue(true);
    mockClaimRuntimeScheduledPostForPublishing.mockResolvedValue(true);
    mockMarkRuntimePostAsPostedInDb.mockResolvedValue({ ...basePost(), status: "POSTED" });
  });

  it("persists redacted provider telemetry on forbidden publish", async () => {
    mockBuildRuntimeLinkedInPublishResult.mockRejectedValue(
      new TestLinkedInIntegrationError("Not enough permissions to access: ugcPosts.CREATE.NO_VERSION", {
        code: "LINKEDIN_PUBLISH_FORBIDDEN",
        accountStatus: "INVALID_CREDENTIALS",
        details: {
          status: 403,
          serviceErrorCode: 100,
          errorCode: "ugcPosts.CREATE.NO_VERSION",
          requestId: "li-req-123",
          endpoint: "/v2/ugcPosts",
          debug: "must-not-be-persisted",
        },
      }),
    );

    const result = await publishRuntimePostLive({
      tenantId: "tenant_socialflow_canary_staff",
      saasId: "p2-24i-saas",
      postId: "post-1",
    });

    expect(result.ok).toBe(false);
    expect(result.code).toBe("LINKEDIN_PUBLISH_FORBIDDEN");

    const lastUpsertArgs = mockUpsertRuntimePostInDb.mock.calls.at(-1)?.[0];
    const publication = lastUpsertArgs?.post?.metadata?.publication as Record<string, unknown>;

    expect(publication.lastErrorCode).toBe("LINKEDIN_PUBLISH_FORBIDDEN");
    expect(publication.providerStatus).toBe(403);
    expect(publication.providerServiceErrorCode).toBe(100);
    expect(publication.providerErrorCode).toBe("ugcPosts.CREATE.NO_VERSION");
    expect(publication.providerRequestId).toBe("li-req-123");
    expect(publication.providerEndpoint).toBe("/v2/ugcPosts");
    expect(JSON.stringify(publication)).not.toContain("debug");
    expect(JSON.stringify(publication)).not.toContain("accessToken");
  });
});
