import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
const exchangeLinkedInCodeForAccessToken = vi.hoisted(() => vi.fn());
const fetchLinkedInUserProfile = vi.hoisted(() => vi.fn());
const parseLinkedInOAuthState = vi.hoisted(() => vi.fn());
const resolveLinkedInIdentity = vi.hoisted(() => vi.fn());
const persistLinkedInConnection = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/social/linkedin", () => ({
  LinkedInIntegrationError: TestLinkedInIntegrationError,
  exchangeLinkedInCodeForAccessToken,
  fetchLinkedInUserProfile,
  parseLinkedInOAuthState,
  resolveLinkedInIdentity,
}));

vi.mock("@/lib/social/linkedin-connection", () => ({
  persistLinkedInConnection,
}));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
}));

vi.mock("@/lib/cf", () => ({
  env,
}));

import { GET } from "@/app/auth/linkedin/callback/route";

describe("/auth/linkedin/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    persistLinkedInConnection.mockResolvedValue({
      status: "persisted",
      account: {
        id: "account-1",
        status: "CONNECTED_REAL",
      },
    });
  });

  it("returns 400 when code is missing", async () => {
    const response = await GET(new Request("https://drako.local/auth/linkedin/callback") as any);

    expect(response.status).toBe(400);
    const payload = await response.json() as { tokenExchange: { error: { code: string } } };
    expect(payload.tokenExchange.error.code).toBe("LINKEDIN_CODE_MISSING");
  });

  it("exchanges the code, fetches profile and persists when tenant and saas are available", async () => {
    const response = await GET(
      new Request("https://drako.local/auth/linkedin/callback?code=abc&saasId=saas-query&tenantId=tenant-query&state=opaque") as any,
    );

    expect(response.status).toBe(200);
    expect(exchangeLinkedInCodeForAccessToken).toHaveBeenCalledWith("abc");
    expect(fetchLinkedInUserProfile).toHaveBeenCalledWith("token-123");
    expect(persistLinkedInConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-query",
        saasId: "saas-query",
      }),
    );

    const payload = await response.json() as {
      ok: boolean;
      tokenExchange: { status: string };
      persistence: { status: string; accountId?: string };
      observability: { status: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.tokenExchange.status).toBe("succeeded");
    expect(payload.persistence.status).toBe("persisted");
    expect(payload.persistence.accountId).toBe("account-1");
    expect(payload.observability.status).toBe("available");
  });

  it("resolves tenant and saas from state when query params are missing", async () => {
    persistLinkedInConnection.mockResolvedValue({
      status: "updated",
      account: {
        id: "account-1",
        status: "CONNECTED_REAL",
      },
    });

    const response = await GET(
      new Request("https://drako.local/auth/linkedin/callback?code=abc&state=tenant_socialflow__socialflow") as any,
    );

    expect(response.status).toBe(200);
    expect(persistLinkedInConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-state",
        saasId: "saas-state",
      }),
    );

    const payload = await response.json() as {
      tenantId: string;
      saasId: string;
      context: { tenantId: string; saasId: string };
      persistence: { status: string };
    };
    expect(payload.tenantId).toBe("tenant-state");
    expect(payload.saasId).toBe("saas-state");
    expect(payload.context.tenantId).toBe("state:compact");
    expect(payload.context.saasId).toBe("state:compact");
    expect(payload.persistence.status).toBe("updated");
  });

  it("returns success without persistence when tenant or saas are missing", async () => {
    getSession.mockResolvedValue(null);
    parseLinkedInOAuthState.mockReturnValue(null);

    const response = await GET(
      new Request("https://drako.local/auth/linkedin/callback?code=abc") as any,
    );

    expect(response.status).toBe(200);
    expect(persistLinkedInConnection).not.toHaveBeenCalled();
    const payload = await response.json() as {
      persistence: { status: string; reason?: string };
      context: { tenantId: string; saasId: string };
    };
    expect(payload.persistence.status).toBe("skipped");
    expect(payload.persistence.reason).toContain("could not be resolved");
    expect(payload.context.tenantId).toBe("missing");
    expect(payload.context.saasId).toBe("missing");
  });

  it("returns success without persistence when db bindings are unavailable", async () => {
    env.mockReturnValue(null);

    const response = await GET(
      new Request("https://drako.local/auth/linkedin/callback?code=abc&tenantId=tenant-query&saasId=saas-query") as any,
    );

    expect(response.status).toBe(200);
    expect(persistLinkedInConnection).not.toHaveBeenCalled();
    const payload = await response.json() as {
      ok: boolean;
      persistence: { status: string; reason?: string };
      observability: { status: string; missingBindings?: string[] };
    };
    expect(payload.ok).toBe(true);
    expect(payload.persistence.status).toBe("skipped");
    expect(payload.persistence.reason).toContain("missing DRACO_DB, SOCIAL_DB");
    expect(payload.observability.status).toBe("unavailable");
    expect(payload.observability.missingBindings).toEqual(["DRACO_DB", "SOCIAL_DB"]);
  });

  it("returns failed persistence when context exists but persistence fails", async () => {
    persistLinkedInConnection.mockRejectedValue(new Error("SOCIAL_DB offline"));

    const response = await GET(
      new Request("https://drako.local/auth/linkedin/callback?code=abc&tenantId=tenant-query&saasId=saas-query") as any,
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      persistence: { status: string; code: string; message: string };
    };
    expect(payload.ok).toBe(true);
    expect(payload.persistence.status).toBe("failed");
    expect(payload.persistence.code).toBe("LINKEDIN_PERSISTENCE_FAILED");
    expect(payload.persistence.message).toBe("SOCIAL_DB offline");
  });

  it("normalizes LinkedIn API errors", async () => {
    exchangeLinkedInCodeForAccessToken.mockRejectedValue(
      new TestLinkedInIntegrationError("invalid code", {
        code: "LINKEDIN_AUTHORIZATION_CODE_INVALID",
        accountStatus: "INVALID_CREDENTIALS",
        details: { status: 401, normalizedReason: "authorization_code_expired_or_reused_or_redirect_mismatch" },
      }),
    );

    const response = await GET(
      new Request("https://drako.local/auth/linkedin/callback?code=bad") as any,
    );

    expect(response.status).toBe(400);
    const payload = await response.json() as {
      tokenExchange: {
        status: string;
        error: { code: string; message: string; details: { normalizedReason: string } };
      };
      persistence: { status: string };
    };
    expect(payload.tokenExchange.status).toBe("failed");
    expect(payload.tokenExchange.error.code).toBe("LINKEDIN_AUTHORIZATION_CODE_INVALID");
    expect(payload.tokenExchange.error.message).toBe("invalid code");
    expect(payload.tokenExchange.error.details.normalizedReason).toBe("authorization_code_expired_or_reused_or_redirect_mismatch");
    expect(payload.persistence.status).toBe("skipped");
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "linkedin",
        activityType: "linkedin_oauth_callback",
        status: "error",
      }),
    );
  });

  it("keeps returning stable json when observability logging fails during invalid code handling", async () => {
    recordObservabilityActivity.mockRejectedValue(new Error("DRACO_DB binding is missing in environment."));
    exchangeLinkedInCodeForAccessToken.mockRejectedValue(
      new TestLinkedInIntegrationError("invalid code", {
        code: "LINKEDIN_AUTHORIZATION_CODE_INVALID",
        accountStatus: "INVALID_CREDENTIALS",
        details: { normalizedReason: "authorization_code_expired_or_reused_or_redirect_mismatch" },
      }),
    );

    const response = await GET(
      new Request("https://drako.local/auth/linkedin/callback?code=bad&tenantId=tenant-query&saasId=saas-query") as any,
    );

    expect(response.status).toBe(400);
    const payload = await response.json() as {
      ok: boolean;
      observability: { status: string };
      tokenExchange: { status: string; error: { code: string } };
    };
    expect(payload.ok).toBe(false);
    expect(payload.tokenExchange.status).toBe("failed");
    expect(payload.tokenExchange.error.code).toBe("LINKEDIN_AUTHORIZATION_CODE_INVALID");
    expect(payload.observability.status).toBe("skipped");
  });
});
