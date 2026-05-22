import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryOne = vi.fn();
const mockRun = vi.fn();
const mockEncryptToken = vi.fn();
const mockIsEncryptedToken = vi.fn();
const mockLogRuntimeEvent = vi.fn();

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
  encryptToken: (...args: unknown[]) => mockEncryptToken(...args),
  isEncryptedToken: (...args: unknown[]) => mockIsEncryptedToken(...args),
}));

vi.mock("../../../../../lib/runtime-observability", () => ({
  logRuntimeEvent: (...args: unknown[]) => mockLogRuntimeEvent(...args),
  runtimeJson: (body: unknown, init?: ResponseInit) =>
    new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "content-type": "application/json" },
    }),
}));

import { POST, __rehardenInternals } from "./route";

function buildRequest(params?: {
  host?: string;
  gate?: string;
}) {
  const headers = new Headers();
  headers.set("host", params?.host ?? "socialflow-canary.drako.systems");
  if (params?.gate) {
    headers.set("x-socialflow-canary-gate", params.gate);
  }
  return new Request("https://socialflow-canary.drako.systems/api/socialflow/runtime/reharden", {
    method: "POST",
    headers,
  });
}

describe("reharden route security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRuntimeEnv = {
      SOCIALFLOW_CANARY_GATE_TOKEN: "gate-secret",
      SOCIALFLOW_RUNTIME_TARGET: "canary",
    };
    mockEncryptToken.mockResolvedValue("encrypted:v1:aes-gcm:iv:cipher");
    mockIsEncryptedToken.mockReturnValue(false);
    mockRun.mockResolvedValue(true);
  });

  it("denies missing gate token with 403", async () => {
    const response = await POST(buildRequest());
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden", code: "GATE_REQUIRED" });
  });

  it("denies non-canary host with 404", async () => {
    const response = await POST(
      buildRequest({
        host: "socialflow.drako.systems",
        gate: "gate-secret",
      }),
    );

    expect(response.status).toBe(404);
  });

  it("denies non-canary runtime target with 404", async () => {
    mockRuntimeEnv = {
      SOCIALFLOW_CANARY_GATE_TOKEN: "gate-secret",
      SOCIALFLOW_RUNTIME_TARGET: "prod",
    };

    const response = await POST(buildRequest({ gate: "gate-secret" }));
    expect(response.status).toBe(404);
  });

  it("rehardens plaintext tokens and does not leak auth_meta or token fields", async () => {
    mockQueryOne.mockResolvedValue({
      id: "row-1",
      tenant_id: "tenant_socialflow_canary_staff",
      saas_id: "p2-24i-saas",
      provider: "LINKEDIN",
      handle: "staff-linkedin",
      display_name: "Staff LinkedIn",
      status: "CONNECTED_REAL",
      auth_meta: JSON.stringify({
        mode: "live",
        accessToken: "plain-access-token",
        idToken: "plain-id-token",
      }),
      is_primary: 1,
      created_at: "2026-05-17T00:00:00.000Z",
      updated_at: "2026-05-17T00:00:00.000Z",
    });

    mockEncryptToken
      .mockResolvedValueOnce("encrypted:v1:aes-gcm:iv-a:cipher-a")
      .mockResolvedValueOnce("encrypted:v1:aes-gcm:iv-b:cipher-b");

    const response = await POST(buildRequest({ gate: "gate-secret" }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updated).toBe(true);
    expect(body).not.toHaveProperty("auth_meta");
    expect(JSON.stringify(body)).not.toContain("plain-access-token");
    expect(JSON.stringify(body)).not.toContain("plain-id-token");
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it("is idempotent when tokens are already encrypted", async () => {
    mockQueryOne.mockResolvedValue({
      id: "row-1",
      tenant_id: "tenant_socialflow_canary_staff",
      saas_id: "p2-24i-saas",
      provider: "LINKEDIN",
      handle: "staff-linkedin",
      display_name: "Staff LinkedIn",
      status: "CONNECTED_REAL",
      auth_meta: JSON.stringify({
        accessToken: "encrypted:v1:aes-gcm:iv-a:cipher-a",
        idToken: "encrypted:v1:aes-gcm:iv-b:cipher-b",
      }),
      is_primary: 1,
      created_at: "2026-05-17T00:00:00.000Z",
      updated_at: "2026-05-17T00:00:00.000Z",
    });

    mockIsEncryptedToken.mockReturnValue(true);

    const response = await POST(buildRequest({ gate: "gate-secret" }));
    const body = await response.json() as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.updated).toBe(false);
    expect(mockRun).not.toHaveBeenCalled();
  });
});

describe("reharden route internals", () => {
  it("normalizes host and strips port", () => {
    expect(__rehardenInternals.normalizeHost("socialflow-canary.drako.systems:443")).toBe(
      "socialflow-canary.drako.systems",
    );
  });
});
