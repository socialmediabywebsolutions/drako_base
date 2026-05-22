import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireCurrentSocialFlowSession = vi.fn();
const mockResolveRuntimeSocialContext = vi.fn();
const mockFindPrimaryRuntimeLinkedInAccount = vi.fn();
const mockValidateRuntimeLinkedInAccount = vi.fn();
const mockIsEncryptedToken = vi.fn();
const mockRun = vi.fn();
const mockLogRuntimeEvent = vi.fn();
const mockRespondDatabaseError = vi.fn();

const TestLinkedInIntegrationError = vi.hoisted(() => class TestLinkedInIntegrationError extends Error {
  code: string;
  accountStatus: "INVALID_CREDENTIALS" | "PENDING";

  constructor(message: string, opts: { code: string; accountStatus: "INVALID_CREDENTIALS" | "PENDING" }) {
    super(message);
    this.code = opts.code;
    this.accountStatus = opts.accountStatus;
  }
});

let mockRuntimeEnv: Record<string, unknown> = {
  SOCIALFLOW_RUNTIME_TARGET: "canary",
};

vi.mock("../../../../../lib/runtime-env", () => ({
  getSocialFlowRuntimeEnv: () => mockRuntimeEnv,
}));

vi.mock("../../../../../lib/auth/session", () => ({
  requireCurrentSocialFlowSession: (...args: unknown[]) => mockRequireCurrentSocialFlowSession(...args),
}));

vi.mock("../../../../../lib/db/runtime-db", () => ({
  run: (...args: unknown[]) => mockRun(...args),
  respondDatabaseError: (...args: unknown[]) => mockRespondDatabaseError(...args),
}));

vi.mock("../../../../../lib/socialflow/runtime-repository-core", () => ({
  nowIso: () => "2026-05-18T10:00:00.000Z",
  serializeJsonRecord: (value: unknown) => JSON.stringify(value),
  resolveRuntimeSocialContext: (...args: unknown[]) => mockResolveRuntimeSocialContext(...args),
}));

vi.mock("../../../../../lib/socialflow/posts-repository", () => ({
  findPrimaryRuntimeLinkedInAccount: (...args: unknown[]) => mockFindPrimaryRuntimeLinkedInAccount(...args),
}));

vi.mock("../../../../../lib/socialflow/linkedin/publishing", () => ({
  validateRuntimeLinkedInAccount: (...args: unknown[]) => mockValidateRuntimeLinkedInAccount(...args),
}));

vi.mock("../../../../../lib/socialflow/token-encryption", () => ({
  isEncryptedToken: (...args: unknown[]) => mockIsEncryptedToken(...args),
}));

vi.mock("../../../../../lib/socialflow/linkedin/core", () => ({
  LinkedInIntegrationError: TestLinkedInIntegrationError,
}));

vi.mock("../../../../../lib/runtime-observability", () => ({
  getRuntimeCorrelationId: () => "test-correlation",
  logRuntimeEvent: (...args: unknown[]) => mockLogRuntimeEvent(...args),
  runtimeJson: (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  }),
}));

import { POST, __validateConnectionInternals } from "./route";

function buildRequest(params?: {
  host?: string;
  saasId?: string;
}) {
  const headers = new Headers();
  headers.set("host", params?.host ?? "socialflow-canary.drako.systems");
  return new Request("https://socialflow-canary.drako.systems/api/socialflow/linkedin/validate-connection", {
    method: "POST",
    headers,
    body: JSON.stringify({ saasId: params?.saasId ?? "p2-24i-saas" }),
  });
}

describe("linkedin validate connection route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeEnv = {
      SOCIALFLOW_RUNTIME_TARGET: "canary",
    };
    mockRespondDatabaseError.mockReturnValue(null);
    mockRequireCurrentSocialFlowSession.mockResolvedValue({
      tenantId: "tenant_socialflow_canary_staff",
      role: "admin",
      userId: "u1",
      email: "staff@drako.systems",
    });
    mockResolveRuntimeSocialContext.mockResolvedValue({
      tenantId: "tenant_socialflow_canary_staff",
      saasId: "p2-24i-saas",
      socialDb: {} as D1Database,
    });
    mockFindPrimaryRuntimeLinkedInAccount.mockResolvedValue({
      id: "acc_1",
      tenantId: "tenant_socialflow_canary_staff",
      saasId: "p2-24i-saas",
      provider: "LINKEDIN",
      handle: "staff-linkedin",
      displayName: "Staff LinkedIn",
      status: "CONNECTED_REAL",
      authMeta: {
        accessToken: "encrypted:v1:aes-gcm:iv:cipher",
        profileId: "profile-1",
      },
      isPrimary: true,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    });
    mockValidateRuntimeLinkedInAccount.mockResolvedValue({
      displayName: "Staff LinkedIn",
      authorUrn: "urn:li:person:profile-1",
      profileId: "profile-1",
      email: "staff@drako.systems",
    });
    mockIsEncryptedToken.mockReturnValue(true);
    mockRun.mockResolvedValue(true);
  });

  it("returns 401 when session is missing", async () => {
    mockRequireCurrentSocialFlowSession.mockRejectedValue(new Error("SESSION_REQUIRED"));
    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "SESSION_REQUIRED" });
  });

  it("returns 403 when session tenant is not canary staff tenant", async () => {
    mockRequireCurrentSocialFlowSession.mockResolvedValue({
      tenantId: "tenant_other",
      role: "admin",
      userId: "u1",
      email: "other@drako.systems",
    });

    const response = await POST(buildRequest());
    expect(response.status).toBe(403);
  });

  it("blocks non-canary context with 404", async () => {
    mockRuntimeEnv = { SOCIALFLOW_RUNTIME_TARGET: "prod" };
    const response = await POST(buildRequest({ host: "socialflow.drako.systems" }));
    expect(response.status).toBe(404);
  });

  it("returns 404 when LinkedIn account row is missing", async () => {
    mockFindPrimaryRuntimeLinkedInAccount.mockResolvedValue(null);

    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(body.error).toBe("LINKEDIN_ACCOUNT_NOT_FOUND");
  });

  it("validates encrypted token path and returns safe payload", async () => {
    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.provider).toBe("LINKEDIN");
    expect(body.status).toBe("CONNECTED_REAL");
    expect(body.tokenEncrypted).toBe(true);
    expect(body.profileMatch).toBe(true);
    expect(JSON.stringify(body)).not.toContain("accessToken");
    expect(JSON.stringify(body)).not.toContain("idToken");
    expect(JSON.stringify(body)).not.toContain("auth_meta");
  });

  it("supports legacy plaintext token compatibility without leaking token", async () => {
    mockFindPrimaryRuntimeLinkedInAccount.mockResolvedValue({
      id: "acc_legacy",
      tenantId: "tenant_socialflow_canary_staff",
      saasId: "p2-24i-saas",
      provider: "LINKEDIN",
      handle: null,
      displayName: "Legacy",
      status: "CONNECTED_REAL",
      authMeta: {
        accessToken: "legacy-plaintext-token",
        linkedInSub: "profile-1",
      },
      isPrimary: true,
      createdAt: "2026-05-17T00:00:00.000Z",
      updatedAt: "2026-05-17T00:00:00.000Z",
    });
    mockIsEncryptedToken.mockReturnValue(false);

    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.tokenEncrypted).toBe(false);
    expect(JSON.stringify(body)).not.toContain("legacy-plaintext-token");
  });

  it("does not leak tokens when linkedin validation fails", async () => {
    mockValidateRuntimeLinkedInAccount.mockRejectedValue(
      new TestLinkedInIntegrationError("forbidden", {
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
    expect(mockRun).toHaveBeenCalled();
  });
});

describe("linkedin validate connection internals", () => {
  it("normalizes host and strips port", () => {
    expect(__validateConnectionInternals.normalizeHost("socialflow-canary.drako.systems:443")).toBe(
      "socialflow-canary.drako.systems",
    );
  });
});
