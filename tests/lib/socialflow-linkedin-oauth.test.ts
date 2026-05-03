import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const exchangeLinkedInCodeForAccessToken = vi.hoisted(() => vi.fn());
const fetchLinkedInUserProfile = vi.hoisted(() => vi.fn());
const parseLinkedInOAuthState = vi.hoisted(() => vi.fn());
const resolveLinkedInIdentity = vi.hoisted(() => vi.fn());
const resolveLinkedInOAuthDiagnostics = vi.hoisted(() => vi.fn());
const persistSocialFlowLinkedInConnection = vi.hoisted(() => vi.fn());
const recordObservabilityActivity = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => vi.fn());
const TestLinkedInIntegrationError = vi.hoisted(() => class TestLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: string;
  details: Record<string, unknown> | null;

  constructor(message: string, opts: { code: string; accountStatus: string; details?: Record<string, unknown> | null }) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
    this.details = opts.details ?? null;
  }
});

vi.mock("@/lib/auth/session", () => ({
  getSession,
}));

vi.mock("@/lib/socialflow/linkedin/core", () => ({
  LinkedInIntegrationError: TestLinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  parseLinkedInOAuthState,
  resolveLinkedInIdentity,
  resolveLinkedInOAuthDiagnostics,
}));

vi.mock("@/lib/socialflow/linkedin/repository", () => ({
  persistSocialFlowLinkedInConnection,
}));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
}));

vi.mock("@/lib/cf", () => ({
  env,
}));

import {
  handleSocialFlowLinkedInCallback,
  resolveSocialFlowLinkedInCallbackSession,
} from "@/lib/socialflow/linkedin/oauth";

describe("socialflow linkedin oauth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LINKEDIN_CLIENT_ID = "linkedin-client-id";
    env.mockReturnValue({ DRACO_DB: {}, SOCIAL_DB: {} });
    getSession.mockResolvedValue({ tenantId: "tenant-session" });
    parseLinkedInOAuthState.mockReturnValue({ tenantId: "tenant-state", saasId: "saas-state", format: "compact" });
    exchangeLinkedInCodeForAccessToken.mockResolvedValue({
      access_token: "token-123",
      expires_in: 3600,
      scope: "openid profile email w_member_social",
      id_token: "id-token-123",
    });
    fetchLinkedInUserProfile.mockResolvedValue({
      sub: "member-123",
      name: "Ada Lovelace",
      email: "ada@example.com",
      email_verified: true,
    });
    resolveLinkedInIdentity.mockReturnValue({
      profileId: "member-123",
      authorUrn: "urn:li:person:member-123",
      displayName: "Ada Lovelace",
      email: "ada@example.com",
      emailVerified: true,
      picture: null,
      locale: null,
    });
    persistSocialFlowLinkedInConnection.mockResolvedValue({
      status: "persisted",
      account: {
        id: "account-1",
        status: "CONNECTED_REAL",
      },
    });
    resolveLinkedInOAuthDiagnostics.mockReturnValue({
      clientId: "linkedin-client-id",
      clientIdSource: "process.env.LINKEDIN_CLIENT_ID",
      clientSecretSource: "process.env.LINKEDIN_CLIENT_SECRET",
      callbackUrl: "http://localhost:8787/api/socialflow/linkedin/callback",
      origin: "http://localhost:8787",
      originSource: "request.url",
      runtime: "worker-local",
      pkceUsed: false,
    });
  });

  it("resolves callback session from auth session", async () => {
    const session = await resolveSocialFlowLinkedInCallbackSession(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=abc") as any,
    );

    expect(session).toEqual({ tenantId: "tenant-session" });
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("returns failure when code is missing", async () => {
    const result = await handleSocialFlowLinkedInCallback(
      new Request("https://drako.local/api/socialflow/linkedin/callback") as any,
      { tenantId: "tenant-state" } as any,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected callback failure");
    expect(result.error.code).toBe("LINKEDIN_CODE_MISSING");
    expect(result.redirectTo).toBe("/socialflow/settings/account?saasId=saas-state");
  });

  it("exchanges the code, fetches profile and persists when tenant and saas are available", async () => {
    const result = await handleSocialFlowLinkedInCallback(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=abc&saasId=saas-query&tenantId=tenant-query&state=opaque") as any,
      { tenantId: "tenant-query" } as any,
    );

    expect(exchangeLinkedInCodeForAccessToken).toHaveBeenCalledWith(
      "abc",
      expect.any(Request),
      { callbackPath: "/api/socialflow/linkedin/callback" },
    );
    expect(fetchLinkedInUserProfile).toHaveBeenCalledWith("token-123");
    expect(persistSocialFlowLinkedInConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-query",
        saasId: "saas-query",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected callback success");
    expect(result.persistence.status).toBe("persisted");
    expect(result.persistence.accountId).toBe("account-1");
    expect(result.observability.status).toBe("available");
    expect(result.diagnostics.callbackUrl).toBe("http://localhost:8787/api/socialflow/linkedin/callback");
  });

  it("returns failure when tenant and saas cannot be resolved", async () => {
    parseLinkedInOAuthState.mockReturnValue(null);

    const result = await handleSocialFlowLinkedInCallback(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=abc") as any,
      null,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected callback failure");
    expect(result.error.code).toBe("LINKEDIN_STATE_INVALID");
  });

  it("returns success without persistence when db bindings are unavailable", async () => {
    env.mockReturnValue(null);

    const result = await handleSocialFlowLinkedInCallback(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=abc&tenantId=tenant-query&saasId=saas-query") as any,
      { tenantId: "tenant-query" } as any,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected callback success");
    expect(result.persistence.status).toBe("skipped");
    expect(result.observability.status).toBe("unavailable");
  });

  it("returns failed persistence when context exists but persistence fails", async () => {
    persistSocialFlowLinkedInConnection.mockRejectedValue(new Error("SOCIAL_DB offline"));

    const result = await handleSocialFlowLinkedInCallback(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=abc&tenantId=tenant-query&saasId=saas-query") as any,
      { tenantId: "tenant-query" } as any,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected callback success");
    expect(result.persistence.status).toBe("failed");
    expect(result.persistence.code).toBe("LINKEDIN_PERSISTENCE_FAILED");
    expect(result.persistence.message).toBe("SOCIAL_DB offline");
  });

  it("normalizes LinkedIn API errors and records observability", async () => {
    exchangeLinkedInCodeForAccessToken.mockRejectedValue(
      new TestLinkedInIntegrationError("invalid code", {
        code: "LINKEDIN_AUTHORIZATION_CODE_INVALID",
        accountStatus: "INVALID_CREDENTIALS",
        details: { normalizedReason: "authorization_code_expired_or_reused_or_redirect_mismatch" },
      }),
    );

    const result = await handleSocialFlowLinkedInCallback(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=bad&tenantId=tenant-query&saasId=saas-query") as any,
      { tenantId: "tenant-query" } as any,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected callback failure");
    expect(result.error.code).toBe("LINKEDIN_AUTHORIZATION_CODE_INVALID");
    expect(result.diagnostics.callbackUrl).toBe("http://localhost:8787/api/socialflow/linkedin/callback");
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "linkedin",
        activityType: "linkedin_oauth_callback",
        status: "error",
      }),
    );
  });

  it("keeps returning stable failure when observability logging fails", async () => {
    recordObservabilityActivity.mockRejectedValue(new Error("DRACO_DB binding is missing in environment."));
    exchangeLinkedInCodeForAccessToken.mockRejectedValue(
      new TestLinkedInIntegrationError("invalid code", {
        code: "LINKEDIN_AUTHORIZATION_CODE_INVALID",
        accountStatus: "INVALID_CREDENTIALS",
        details: { normalizedReason: "authorization_code_expired_or_reused_or_redirect_mismatch" },
      }),
    );

    const result = await handleSocialFlowLinkedInCallback(
      new Request("https://drako.local/api/socialflow/linkedin/callback?code=bad&tenantId=tenant-query&saasId=saas-query") as any,
      { tenantId: "tenant-query" } as any,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected callback failure");
    expect(result.error.code).toBe("LINKEDIN_AUTHORIZATION_CODE_INVALID");
  });
});
