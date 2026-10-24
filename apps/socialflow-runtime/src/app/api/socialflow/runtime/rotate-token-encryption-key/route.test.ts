import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryOne = vi.fn();
const mockRun = vi.fn();
const mockLogRuntimeEvent = vi.fn();
const mockDecryptToken = vi.fn();
const mockEncryptTokenWithNext = vi.fn();
const mockIsEncryptedToken = vi.fn();
const mockIsNextEncryptionAvailable = vi.fn();

const TestTokenEncryptionError = vi.hoisted(() => class TestTokenEncryptionError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
});

let mockRuntimeEnv: Record<string, unknown> = {
  SOCIALFLOW_CANARY_GATE_TOKEN: "gate-secret",
  SOCIALFLOW_RUNTIME_TARGET: "canary",
};

vi.mock("../../../../../lib/runtime-env", () => ({
  getSocialFlowRuntimeEnv: () => mockRuntimeEnv,
}));

vi.mock("../../../../../lib/db/runtime-db", () => ({
  ensureSocialDb: () => ({}) as D1Database,
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

vi.mock("../../../../../lib/socialflow/token-encryption", () => ({
  TokenEncryptionError: TestTokenEncryptionError,
  decryptToken: (...args: unknown[]) => mockDecryptToken(...args),
  encryptTokenWithNext: (...args: unknown[]) => mockEncryptTokenWithNext(...args),
  isEncryptedToken: (...args: unknown[]) => mockIsEncryptedToken(...args),
  isNextEncryptionAvailable: (...args: unknown[]) => mockIsNextEncryptionAvailable(...args),
}));

vi.mock("../../../../../lib/runtime-observability", () => ({
  logRuntimeEvent: (...args: unknown[]) => mockLogRuntimeEvent(...args),
  runtimeJson: (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "content-type": "application/json" },
    }),
}));

import { POST, __tokenKeyRotationInternals } from "./route";

function buildRequest(params?: {
  host?: string;
  gate?: string;
  body?: Record<string, unknown>;
}) {
  const headers = new Headers();
  headers.set("host", params?.host ?? "socialflow-canary.drako.systems");
  if (params?.gate) {
    headers.set("x-socialflow-canary-gate", params.gate);
  }

  return new Request("https://socialflow-canary.drako.systems/api/socialflow/runtime/rotate-token-encryption-key", {
    method: "POST",
    headers,
    body: JSON.stringify(params?.body ?? {}),
  });
}

describe("runtime rotate-token-encryption-key route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeEnv = {
      SOCIALFLOW_CANARY_GATE_TOKEN: "gate-secret",
      SOCIALFLOW_RUNTIME_TARGET: "canary",
    };
    mockIsNextEncryptionAvailable.mockReturnValue(true);
    mockQueryOne.mockResolvedValue({
      id: "row-1",
      tenant_id: "tenant_socialflow_canary_staff",
      saas_id: "p2-24i-saas",
      provider: "LINKEDIN",
      status: "CONNECTED_REAL",
      auth_meta: JSON.stringify({
        accessToken: "encrypted:v1:aes-gcm:iv-a:cipher-a",
        idToken: "encrypted:v1:aes-gcm:iv-b:cipher-b",
      }),
      updated_at: "2026-05-18T00:00:00.000Z",
    });
    mockIsEncryptedToken.mockReturnValue(true);
    mockDecryptToken.mockResolvedValue("plaintext-token");
    mockEncryptTokenWithNext.mockResolvedValue("encrypted:v1:aes-gcm:iv-next:cipher-next");
    mockRun.mockResolvedValue(true);
  });

  it("denies missing gate token with 403", async () => {
    const response = await POST(buildRequest({ body: { confirmRotate: true } }));
    expect(response.status).toBe(403);
  });

  it("denies non-canary host with 404", async () => {
    const response = await POST(
      buildRequest({
        host: "socialflow.drako.systems",
        gate: "gate-secret",
        body: { confirmRotate: true },
      }),
    );
    expect(response.status).toBe(404);
  });

  it("requires NEXT secret availability with 409", async () => {
    mockIsNextEncryptionAvailable.mockReturnValue(false);
    const response = await POST(buildRequest({ gate: "gate-secret", body: { confirmRotate: true } }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(409);
    expect(body.code).toBe("ENCRYPTION_NEXT_SECRET_MISSING");
  });

  it("requires explicit confirmRotate=true", async () => {
    const response = await POST(buildRequest({ gate: "gate-secret" }));
    expect(response.status).toBe(400);
  });

  it("rotates encrypted tokens and returns safe response", async () => {
    const response = await POST(buildRequest({ gate: "gate-secret", body: { confirmRotate: true } }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updated).toBe(true);
    expect(body.status).toBe("CONNECTED_REAL");
    expect(JSON.stringify(body)).not.toContain("accessToken");
    expect(JSON.stringify(body)).not.toContain("idToken");
    expect(JSON.stringify(body)).not.toContain("auth_meta");
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("is idempotent if token already rotated with NEXT key", async () => {
    mockDecryptToken.mockImplementation((_value: string, options?: { allowNextFallback?: boolean }) => {
      if (options?.allowNextFallback === false) {
        throw new TestTokenEncryptionError("fail", "DECRYPTION_FAILED");
      }
      return Promise.resolve("plaintext-token");
    });

    const response = await POST(buildRequest({ gate: "gate-secret", body: { confirmRotate: true } }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updated).toBe(false);
    expect(mockRun).not.toHaveBeenCalled();
  });
});

describe("token key rotation internals", () => {
  it("normalizes host and strips port", () => {
    expect(__tokenKeyRotationInternals.normalizeHost("socialflow-canary.drako.systems:443")).toBe(
      "socialflow-canary.drako.systems",
    );
  });
});
