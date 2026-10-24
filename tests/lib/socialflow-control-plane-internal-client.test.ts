import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  SocialFlowControlPlaneInternalApiError,
  fetchSocialFlowHealth,
  fetchSocialFlowObservabilitySnapshot,
  postSocialFlowEvent,
  postSocialFlowOperatorAction,
  triggerSocialFlowAutomation,
} from "@/lib/capabilities/internal-api-clients/socialflow-control-plane";
import type {
  SocialFlowAutomationTriggerRequest,
  SocialFlowAutomationTriggerResponse,
  SocialFlowEventRequest,
  SocialFlowEventResponse,
  SocialFlowHealthResponse,
  SocialFlowObservabilitySnapshot,
  SocialFlowOperatorActionRequest,
  SocialFlowOperatorActionResponse,
} from "@/lib/capabilities/internal-api-types/socialflow";

describe("socialflow control plane internal api client", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
    delete process.env.SOCIALFLOW_INTERNAL_API_BASE_URL;
    delete process.env.INTERNAL_API_BASE_URL;
    delete process.env.DRAKO_INTERNAL_API_BASE_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createJsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  function createInvalidJsonResponse(status = 200) {
    return new Response("{invalid-json", {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("does not import forbidden modules", () => {
    const source = readFileSync(
      "src/lib/capabilities/internal-api-clients/socialflow-control-plane.ts",
      "utf8",
    );

    expect(source).not.toContain("@/lib/socialflow/contracts/campobase");
    expect(source).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(source).not.toContain("@/lib/campobase/socialflow-service");
    expect(source).not.toContain("@/lib/campobase/");
  });

  it("does not create legacy-named socialflow-campobase client file", () => {
    expect(() => readFileSync(
      "src/lib/capabilities/internal-api-clients/socialflow-campobase.ts",
      "utf8",
    )).toThrow();
  });

  it("sends headers with explicit base URL and service token", async () => {
    const payload: SocialFlowHealthResponse = {
      service: "socialflow",
      status: "ok",
      runtime: "monolith",
      version: "1.0.0",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-health",
      checks: {
        contract: { status: "ok", detail: "contract" },
        runtime: { status: "ok", detail: "runtime" },
        auth: { status: "ok", detail: "auth" },
      },
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));

    const response = await fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      serviceToken: "explicit-token",
      requestId: "req-health",
      tenantId: "tenant-1",
      idempotencyKey: "idem-1",
      fetchImpl: fetchMock,
    });

    expect(response).toEqual(payload);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://drako.systems/api/internal/socialflow/health");
    expect(init.method).toBe("GET");

    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer explicit-token");
    expect(headers.get("X-Drako-Control-Plane")).toBe("campobase");
    expect(headers.get("X-Drako-Request-Id")).toBe("req-health");
    expect(headers.get("X-Drako-Tenant-Id")).toBe("tenant-1");
    expect(headers.get("Idempotency-Key")).toBe("idem-1");
  });

  it("generates requestId when not provided", async () => {
    const payload: SocialFlowHealthResponse = {
      service: "socialflow",
      status: "ok",
      runtime: "monolith",
      version: "1.0.0",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "server-req",
      checks: {
        contract: { status: "ok", detail: "contract" },
        runtime: { status: "ok", detail: "runtime" },
        auth: { status: "ok", detail: "auth" },
      },
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));

    await fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      fetchImpl: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Drako-Request-Id")).toBeTruthy();
    expect(headers.get("X-Drako-Request-Id")?.length).toBeGreaterThan(5);
  });

  it("respects provided requestId", async () => {
    const payload: SocialFlowHealthResponse = {
      service: "socialflow",
      status: "ok",
      runtime: "monolith",
      version: "1.0.0",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-fixed",
      checks: {
        contract: { status: "ok", detail: "contract" },
        runtime: { status: "ok", detail: "runtime" },
        auth: { status: "ok", detail: "auth" },
      },
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));

    await fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-fixed",
      fetchImpl: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Drako-Request-Id")).toBe("req-fixed");
  });

  it("adds tenant header only when tenantId exists", async () => {
    const payload: SocialFlowHealthResponse = {
      service: "socialflow",
      status: "ok",
      runtime: "monolith",
      version: "1.0.0",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-tenant",
      checks: {
        contract: { status: "ok", detail: "contract" },
        runtime: { status: "ok", detail: "runtime" },
        auth: { status: "ok", detail: "auth" },
      },
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));

    await fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      tenantId: "tenant-tenant",
      fetchImpl: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Drako-Tenant-Id")).toBe("tenant-tenant");
  });

  it("does not add tenant header when tenantId is null", async () => {
    const payload: SocialFlowHealthResponse = {
      service: "socialflow",
      status: "ok",
      runtime: "monolith",
      version: "1.0.0",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-null-tenant",
      checks: {
        contract: { status: "ok", detail: "contract" },
        runtime: { status: "ok", detail: "runtime" },
        auth: { status: "ok", detail: "auth" },
      },
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));

    await fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      tenantId: null,
      fetchImpl: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("X-Drako-Tenant-Id")).toBeNull();
  });

  it("adds idempotency header only when provided", async () => {
    const payload: SocialFlowHealthResponse = {
      service: "socialflow",
      status: "ok",
      runtime: "monolith",
      version: "1.0.0",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-idempotency",
      checks: {
        contract: { status: "ok", detail: "contract" },
        runtime: { status: "ok", detail: "runtime" },
        auth: { status: "ok", detail: "auth" },
      },
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));

    await fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      idempotencyKey: "idem-key-xyz",
      fetchImpl: fetchMock,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);
    expect(headers.get("Idempotency-Key")).toBe("idem-key-xyz");
  });

  it("handles health 200", async () => {
    const payload: SocialFlowHealthResponse = {
      service: "socialflow",
      status: "ok",
      runtime: "monolith",
      version: "1.0.0",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-health-200",
      checks: {
        contract: { status: "ok", detail: "contract" },
        runtime: { status: "ok", detail: "runtime" },
        auth: { status: "ok", detail: "auth" },
      },
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));
    const result = await fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-health-200",
      fetchImpl: fetchMock,
    });

    expect(result.status).toBe("ok");
  });

  it("handles observability 200", async () => {
    const payload: SocialFlowObservabilitySnapshot = {
      service: "socialflow",
      runtime: "monolith",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-obs-200",
      tenantId: "tenant-obs",
      status: "ok",
      metrics: {
        activeAutomations: 1,
        queuedJobs: 2,
        failedJobsLast24h: 0,
        successfulJobsLast24h: 4,
        averageLatencyMs: 123,
      },
      recentErrors: [],
      warnings: [],
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));
    const result = await fetchSocialFlowObservabilitySnapshot({
      baseUrl: "https://drako.systems",
      requestId: "req-obs-200",
      fetchImpl: fetchMock,
    });

    expect(result.metrics.activeAutomations).toBe(1);
  });

  it("handles events 202", async () => {
    const request: SocialFlowEventRequest = {
      eventType: "socialflow.automation.requested",
      source: "campobase",
      occurredAt: "2026-06-06T00:00:00.000Z",
      tenantId: "tenant-events",
      correlationId: "corr-events",
      payload: { ok: true },
    };
    const payload: SocialFlowEventResponse = {
      service: "socialflow",
      runtime: "monolith",
      accepted: true,
      eventId: "evt-1",
      eventType: request.eventType,
      requestId: "req-events-202",
      tenantId: "tenant-events",
      timestamp: "2026-06-06T00:00:00.000Z",
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 202));
    const result = await postSocialFlowEvent(request, {
      baseUrl: "https://drako.systems",
      requestId: "req-events-202",
      idempotencyKey: "idem-events",
      fetchImpl: fetchMock,
    });

    expect(result.accepted).toBe(true);
  });

  it("handles automation trigger 202", async () => {
    const request: SocialFlowAutomationTriggerRequest = {
      automationType: "generate_schedule",
      source: "campobase",
      tenantId: "tenant-auto",
      correlationId: "corr-auto",
      requestedBy: "owner-1",
      payload: { week: 1 },
    };
    const payload: SocialFlowAutomationTriggerResponse = {
      service: "socialflow",
      runtime: "monolith",
      accepted: true,
      automationId: "auto-1",
      automationType: request.automationType,
      requestId: "req-auto-202",
      tenantId: "tenant-auto",
      timestamp: "2026-06-06T00:00:00.000Z",
      status: "queued",
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 202));
    const result = await triggerSocialFlowAutomation(request, {
      baseUrl: "https://drako.systems",
      requestId: "req-auto-202",
      idempotencyKey: "idem-auto",
      fetchImpl: fetchMock,
    });

    expect(result.status).toBe("queued");
  });

  it("handles operator actions 202", async () => {
    const request: SocialFlowOperatorActionRequest = {
      actionType: "request_diagnostics",
      source: "campobase",
      tenantId: "tenant-op",
      correlationId: "corr-op",
      requestedBy: "owner-2",
      reason: "manual check",
      payload: { includeHistory: true },
    };
    const payload: SocialFlowOperatorActionResponse = {
      service: "socialflow",
      runtime: "monolith",
      accepted: true,
      actionId: "op-1",
      actionType: request.actionType,
      requestId: "req-op-202",
      tenantId: "tenant-op",
      timestamp: "2026-06-06T00:00:00.000Z",
      status: "queued",
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 202));
    const result = await postSocialFlowOperatorAction(request, {
      baseUrl: "https://drako.systems",
      requestId: "req-op-202",
      idempotencyKey: "idem-op",
      fetchImpl: fetchMock,
    });

    expect(result.accepted).toBe(true);
  });

  it("handles 400", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        code: "INTERNAL_API_BAD_REQUEST",
        message: "bad payload",
        requestId: "req-400",
      }, 400),
    );

    await expect(fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-400",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowControlPlaneInternalApiError>>({
      name: "SocialFlowControlPlaneInternalApiError",
      status: 400,
      code: "INTERNAL_API_BAD_REQUEST",
      requestId: "req-400",
    });
  });

  it("handles 401", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        code: "INTERNAL_API_UNAUTHORIZED",
        message: "missing bearer",
        requestId: "req-401",
      }, 401),
    );

    await expect(fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-401",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowControlPlaneInternalApiError>>({
      name: "SocialFlowControlPlaneInternalApiError",
      status: 401,
      code: "INTERNAL_API_UNAUTHORIZED",
      requestId: "req-401",
    });
  });

  it("handles 403", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        code: "INTERNAL_API_FORBIDDEN",
        message: "forbidden",
        requestId: "req-403",
      }, 403),
    );

    await expect(fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-403",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowControlPlaneInternalApiError>>({
      name: "SocialFlowControlPlaneInternalApiError",
      status: 403,
      code: "INTERNAL_API_FORBIDDEN",
      requestId: "req-403",
    });
  });

  it("handles 404", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        message: "not found",
      }, 404),
    );

    await expect(fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-404",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowControlPlaneInternalApiError>>({
      name: "SocialFlowControlPlaneInternalApiError",
      status: 404,
      code: "INTERNAL_API_BAD_REQUEST",
      requestId: "req-404",
    });
  });

  it("handles 500", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        code: "INTERNAL_API_BAD_REQUEST",
        message: "server error",
        requestId: "req-500",
      }, 500),
    );

    await expect(fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-500",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowControlPlaneInternalApiError>>({
      name: "SocialFlowControlPlaneInternalApiError",
      status: 500,
      code: "INTERNAL_API_BAD_REQUEST",
      requestId: "req-500",
    });
  });

  it("handles network error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });

    await expect(fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-network",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowControlPlaneInternalApiError>>({
      name: "SocialFlowControlPlaneInternalApiError",
      status: 500,
      code: "INTERNAL_API_BAD_REQUEST",
      requestId: "req-network",
    });
  });

  it("handles invalid JSON response", async () => {
    const fetchMock = vi.fn(async () => createInvalidJsonResponse(200));

    await expect(fetchSocialFlowHealth({
      baseUrl: "https://drako.systems",
      requestId: "req-invalid-json",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowControlPlaneInternalApiError>>({
      name: "SocialFlowControlPlaneInternalApiError",
      status: 500,
      code: "INTERNAL_API_BAD_REQUEST",
      requestId: "req-invalid-json",
    });
  });

  it("keeps legacy campobase socialflow service as canonical adapter", () => {
    const source = readFileSync(
      "src/lib/campobase/socialflow-service.ts",
      "utf8",
    );

    expect(source).not.toContain("@/lib/socialflow/contracts/campobase");
    expect(source).toContain("@/lib/campamento-base/socialflow-control-plane-service");
  });

  it("does not modify namespace freeze test", () => {
    const source = readFileSync(
      "tests/architecture/campobase-namespace-freeze.test.ts",
      "utf8",
    );

    expect(source).toContain("FROZEN_CAMPOBASE_IMPORT_ALLOWLIST");
    expect(source).toContain("@/lib/campobase/socialflow-service");
  });
});
