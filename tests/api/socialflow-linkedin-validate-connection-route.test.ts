import { beforeEach, describe, expect, it, vi } from "vitest";

const requireCurrentSocialFlowSession = vi.hoisted(() => vi.fn());
const resolveSocialContext = vi.hoisted(() => vi.fn());
const listSaasSocialAccounts = vi.hoisted(() => vi.fn());
const upsertSaasSocialAccount = vi.hoisted(() => vi.fn());
const validateAccount = vi.hoisted(() => vi.fn());
const isEncryptedToken = vi.hoisted(() => vi.fn());

const MockLinkedInIntegrationError = vi.hoisted(() => class MockLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: "INVALID_CREDENTIALS" | "PENDING";
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    opts: { code: string; accountStatus: "INVALID_CREDENTIALS" | "PENDING"; details?: Record<string, unknown> | null },
  ) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
    this.details = opts.details ?? null;
  }
});

vi.mock("@/lib/socialflow/auth/request", () => ({
  requireCurrentSocialFlowSession,
}));

vi.mock("@/lib/socialflow/linkedin/core", () => ({
  LinkedInIntegrationError: MockLinkedInIntegrationError,
}));

vi.mock("@/lib/socialflow/linkedin/publishing", () => ({
  validateAccount,
}));

vi.mock("@/lib/socialflow/token-encryption", () => ({
  isEncryptedToken,
}));

vi.mock("@/lib/socialflow/repository", () => ({
  resolveSocialContext,
  listSaasSocialAccounts,
  upsertSaasSocialAccount,
  SocialContextError: class SocialContextError extends Error {},
}));

import { POST } from "@/app/api/socialflow/linkedin/validate-connection/route";

function buildRequest(saasId = "socialflow") {
  return new Request("https://socialflow.drako.systems/api/socialflow/linkedin/validate-connection", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ saasId }),
  });
}

describe("/api/socialflow/linkedin/validate-connection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireCurrentSocialFlowSession.mockResolvedValue({
      userId: "u1",
      email: "staff@drako.systems",
      role: "admin",
      tenantId: "tenant-socialflow",
    });
    resolveSocialContext.mockResolvedValue({
      tenantId: "tenant-socialflow",
      saasId: "socialflow",
      socialDb: {},
    });
    listSaasSocialAccounts.mockResolvedValue([
      {
        id: "acc_1",
        tenantId: "tenant-socialflow",
        saasId: "socialflow",
        provider: "LINKEDIN",
        handle: "staff@drako.systems",
        displayName: "Staff",
        status: "CONNECTED_REAL",
        authMeta: {
          accessToken: "encrypted:v1:aes-gcm:iv:cipher",
          profileId: "profile-1",
        },
        isPrimary: true,
        createdAt: "2026-05-18T10:00:00.000Z",
        updatedAt: "2026-05-18T10:00:00.000Z",
      },
    ]);
    validateAccount.mockResolvedValue({
      profileId: "profile-1",
      authorUrn: "urn:li:person:profile-1",
      displayName: "Staff",
      email: "staff@drako.systems",
    });
    isEncryptedToken.mockReturnValue(true);
    upsertSaasSocialAccount.mockResolvedValue({});
  });

  it("returns 401 without session", async () => {
    requireCurrentSocialFlowSession.mockRejectedValue(new Error("SESSION_REQUIRED"));
    const response = await POST(buildRequest());
    expect(response.status).toBe(401);
  });

  it("returns 404 when linkedin account is missing", async () => {
    listSaasSocialAccounts.mockResolvedValue([]);
    const response = await POST(buildRequest());
    expect(response.status).toBe(404);
  });

  it("returns 200 with safe payload when validation succeeds", async () => {
    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("LINKEDIN");
    expect(body.status).toBe("CONNECTED_REAL");
    expect(body.tokenEncrypted).toBe(true);
    expect(JSON.stringify(body)).not.toContain("accessToken");
    expect(JSON.stringify(body)).not.toContain("idToken");
    expect(JSON.stringify(body)).not.toContain("auth_meta");
  });

  it("returns safe 502 payload when provider validation fails", async () => {
    validateAccount.mockRejectedValue(
      new MockLinkedInIntegrationError("provider failed", {
        code: "LINKEDIN_PROFILE_FETCH_FAILED",
        accountStatus: "INVALID_CREDENTIALS",
      }),
    );

    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("LINKEDIN_VALIDATION_FAILED");
    expect(body.code).toBe("LINKEDIN_PROFILE_FETCH_FAILED");
    expect(JSON.stringify(body)).not.toContain("accessToken");
    expect(JSON.stringify(body)).not.toContain("idToken");
    expect(JSON.stringify(body)).not.toContain("auth_meta");
  });

  it("returns safe 502 payload when publish scope is missing", async () => {
    listSaasSocialAccounts.mockResolvedValue([
      {
        id: "acc_1",
        tenantId: "tenant-socialflow",
        saasId: "socialflow",
        provider: "LINKEDIN",
        handle: "staff@drako.systems",
        displayName: "Staff",
        status: "CONNECTED_REAL",
        authMeta: {
          accessToken: "encrypted:v1:aes-gcm:iv:cipher",
          profileId: "profile-1",
          scope: "openid profile email",
        },
        isPrimary: true,
        createdAt: "2026-05-18T10:00:00.000Z",
        updatedAt: "2026-05-18T10:00:00.000Z",
      },
    ]);
    validateAccount.mockRejectedValue(
      new MockLinkedInIntegrationError("scope missing", {
        code: "LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL",
        accountStatus: "INVALID_CREDENTIALS",
      }),
    );

    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(502);
    expect(body.ok).toBe(false);
    expect(body.error).toBe("LINKEDIN_VALIDATION_FAILED");
    expect(body.code).toBe("LINKEDIN_SCOPE_MISSING_W_MEMBER_SOCIAL");
    expect(JSON.stringify(body)).not.toContain("accessToken");
    expect(JSON.stringify(body)).not.toContain("idToken");
    expect(JSON.stringify(body)).not.toContain("auth_meta");
  });
});
