import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentSocialFlowSessionFromRequest = vi.hoisted(() => vi.fn());
const exchangeInstagramCode = vi.hoisted(() => vi.fn());
const exchangeForLongLivedInstagramToken = vi.hoisted(() => vi.fn());
const fetchInstagramUser = vi.hoisted(() => vi.fn());
const persistInstagramOAuthConnection = vi.hoisted(() => vi.fn());
const resolveInstagramCallbackUrl = vi.hoisted(() => vi.fn());
const verifyAndConsumeOAuthState = vi.hoisted(() => vi.fn());
const TestInstagramOAuthError = vi.hoisted(() => class TestInstagramOAuthError extends Error {
  code: string;
  details: Record<string, unknown> | null;

  constructor(message: string, opts: { code: string; details?: Record<string, unknown> | null }) {
    super(message);
    this.name = "InstagramOAuthError";
    this.code = opts.code;
    this.details = opts.details ?? null;
  }
});

vi.mock("@/lib/socialflow/auth/request", () => ({
  getCurrentSocialFlowSessionFromRequest,
}));

vi.mock("@/lib/socialflow/instagram/oauth", () => ({
  InstagramOAuthError: TestInstagramOAuthError,
  exchangeInstagramCode,
  exchangeForLongLivedInstagramToken,
  fetchInstagramUser,
  persistInstagramOAuthConnection,
  resolveInstagramCallbackUrl,
}));

vi.mock("@/lib/socialflow/oauth/state", () => ({
  verifyAndConsumeOAuthState,
}));

import { GET } from "@/app/api/socialflow/oauth/instagram/callback/route";

const SIGNED_CALLBACK_URL = "https://drako.local/api/socialflow/oauth/instagram/callback";

function verifiedState(overrides: Partial<{
  tenantId: string;
  saasId: string;
  redirectTo: string | null;
  callbackUrl: string | null;
}> = {}) {
  return {
    ok: true as const,
    provider: "instagram" as const,
    tenantId: overrides.tenantId ?? "tenant-1",
    saasId: overrides.saasId ?? "saas-1",
    redirectTo: overrides.redirectTo ?? "/socialflow/settings/accounts?saasId=saas-1",
    callbackUrl: overrides.callbackUrl ?? SIGNED_CALLBACK_URL,
    nonce: "nonce-1",
    issuedAt: Date.now(),
  };
}

describe("Instagram OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyAndConsumeOAuthState.mockResolvedValue(verifiedState());
    getCurrentSocialFlowSessionFromRequest.mockResolvedValue({ tenantId: "tenant-1" });
    resolveInstagramCallbackUrl.mockReturnValue("https://fallback.local/api/socialflow/oauth/instagram/callback");
    exchangeInstagramCode.mockResolvedValue({ access_token: "short-token", token_type: "bearer", expires_in: 3600 });
    exchangeForLongLivedInstagramToken.mockResolvedValue({ access_token: "long-token", token_type: "bearer", expires_in: 5184000 });
    fetchInstagramUser.mockResolvedValue({ id: "ig-user-1", username: "testuser" });
    persistInstagramOAuthConnection.mockResolvedValue({ status: "persisted", accountId: "account-1" });
  });

  it("resolves tenantId/saasId/callbackUrl from a verified signed state and persists the connection", async () => {
    const response = await GET(
      new Request(`${SIGNED_CALLBACK_URL}?code=abc&state=opaque`) as any,
    );

    expect(verifyAndConsumeOAuthState).toHaveBeenCalledWith("opaque", { provider: "instagram" });
    expect(exchangeInstagramCode).toHaveBeenCalledWith({ code: "abc", callbackUrl: SIGNED_CALLBACK_URL });
    // callbackUrl must come from the signed state, never recomputed from the request —
    // that's the whole point of signing it in.
    expect(resolveInstagramCallbackUrl).not.toHaveBeenCalled();
    expect(persistInstagramOAuthConnection).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "tenant-1", saasId: "saas-1" }),
    );

    expect(response.status).toBe(308);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("/socialflow/settings/accounts");
    expect(location).toContain("instagram=connected");
    expect(location).toContain("saasId=saas-1");
    expect(location).toContain("accountId=account-1");
  });

  it("redirects to INSTAGRAM_STATE_INVALID when the signed state fails verification", async () => {
    verifyAndConsumeOAuthState.mockResolvedValue({ ok: false, reason: "signature_invalid" });

    const response = await GET(
      new Request(`${SIGNED_CALLBACK_URL}?code=abc&state=tampered`) as any,
    );

    expect(exchangeInstagramCode).not.toHaveBeenCalled();
    expect(persistInstagramOAuthConnection).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("instagram=error");
    expect(location).toContain("code=INSTAGRAM_STATE_INVALID");
  });

  it("redirects to INSTAGRAM_STATE_REPLAYED when the state nonce was already consumed", async () => {
    verifyAndConsumeOAuthState.mockResolvedValue({ ok: false, reason: "nonce_replayed" });

    const response = await GET(
      new Request(`${SIGNED_CALLBACK_URL}?code=abc&state=opaque`) as any,
    );

    expect(exchangeInstagramCode).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("code=INSTAGRAM_STATE_REPLAYED");
  });

  it("redirects to INSTAGRAM_TENANT_MISMATCH when the session tenant differs from the verified state's tenant", async () => {
    verifyAndConsumeOAuthState.mockResolvedValue(verifiedState({ tenantId: "tenant-victim" }));
    getCurrentSocialFlowSessionFromRequest.mockResolvedValue({ tenantId: "tenant-attacker" });

    const response = await GET(
      new Request(`${SIGNED_CALLBACK_URL}?code=abc&state=opaque`) as any,
    );

    expect(exchangeInstagramCode).not.toHaveBeenCalled();
    expect(persistInstagramOAuthConnection).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("code=INSTAGRAM_TENANT_MISMATCH");
  });

  it("redirects to INSTAGRAM_OAUTH_DENIED without attempting token exchange when the provider reports an error", async () => {
    const response = await GET(
      new Request(`${SIGNED_CALLBACK_URL}?error=access_denied&state=opaque`) as any,
    );

    expect(exchangeInstagramCode).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("code=INSTAGRAM_OAUTH_DENIED");
  });

  it("redirects to INSTAGRAM_CODE_MISSING when the code query param is absent", async () => {
    const response = await GET(
      new Request(`${SIGNED_CALLBACK_URL}?state=opaque`) as any,
    );

    expect(exchangeInstagramCode).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("code=INSTAGRAM_CODE_MISSING");
  });
});
