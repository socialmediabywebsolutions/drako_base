import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  SocialFlowOwnerInternalApiError,
  fetchSocialFlowOwnerSnapshot,
  mapSocialFlowOwnerSnapshotToLegacyDashboard,
} from "@/lib/capabilities/internal-api-clients/socialflow-owner";
import type { SocialFlowOwnerSnapshotResponse } from "@/lib/capabilities/internal-api-types/socialflow";

describe("socialflow owner internal api client", () => {
  const originalFetch = globalThis.fetch;

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
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function createJsonResponse(body: unknown, status: number) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("sends internal headers and returns 200 payload", async () => {
    const payload: SocialFlowOwnerSnapshotResponse = {
      service: "socialflow",
      runtime: "monolith",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-200",
      tenantId: "tenant-1",
      snapshot: {
        status: "ok",
        activeCampaigns: 4,
        scheduledPosts: 9,
        failedPostsLast24h: 1,
        connectedProfiles: 2,
        lastRunAt: null,
      },
      warnings: [],
    };

    const fetchMock = vi.fn(async () => createJsonResponse(payload, 200));

    const response = await fetchSocialFlowOwnerSnapshot({
      baseUrl: "https://drako.systems",
      requestId: "req-200",
      tenantId: "tenant-1",
      fetchImpl: fetchMock,
    });

    expect(response).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://drako.systems/api/internal/socialflow/owner/snapshot");

    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer test-service-token");
    expect(headers.get("X-Drako-Control-Plane")).toBe("campobase");
    expect(headers.get("X-Drako-Request-Id")).toBe("req-200");
    expect(headers.get("X-Drako-Tenant-Id")).toBe("tenant-1");
  });

  it("handles 401 in controlled way", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        code: "INTERNAL_API_UNAUTHORIZED",
        message: "Authorization bearer token is required",
        requestId: "req-401",
      }, 401),
    );

    await expect(fetchSocialFlowOwnerSnapshot({
      baseUrl: "https://drako.systems",
      requestId: "req-401",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowOwnerInternalApiError>>({
      name: "SocialFlowOwnerInternalApiError",
      status: 401,
      code: "INTERNAL_API_UNAUTHORIZED",
      requestId: "req-401",
    });
  });

  it("handles 403 in controlled way", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        code: "INTERNAL_API_FORBIDDEN",
        message: "Invalid service token",
        requestId: "req-403",
      }, 403),
    );

    await expect(fetchSocialFlowOwnerSnapshot({
      baseUrl: "https://drako.systems",
      requestId: "req-403",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowOwnerInternalApiError>>({
      name: "SocialFlowOwnerInternalApiError",
      status: 403,
      code: "INTERNAL_API_FORBIDDEN",
      requestId: "req-403",
    });
  });

  it("handles 500 in controlled way", async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        code: "INTERNAL_API_BAD_REQUEST",
        message: "unexpected failure",
        requestId: "req-500",
      }, 500),
    );

    await expect(fetchSocialFlowOwnerSnapshot({
      baseUrl: "https://drako.systems",
      requestId: "req-500",
      fetchImpl: fetchMock,
    })).rejects.toMatchObject<Partial<SocialFlowOwnerInternalApiError>>({
      name: "SocialFlowOwnerInternalApiError",
      status: 500,
      code: "INTERNAL_API_BAD_REQUEST",
      requestId: "req-500",
    });
  });

  it("maps internal response to legacy owner dashboard shape", () => {
    const response: SocialFlowOwnerSnapshotResponse = {
      service: "socialflow",
      runtime: "monolith",
      timestamp: "2026-06-06T00:00:00.000Z",
      requestId: "req-map",
      tenantId: "tenant-map",
      snapshot: {
        status: "ok",
        activeCampaigns: 5,
        scheduledPosts: 7,
        failedPostsLast24h: 0,
        connectedProfiles: 3,
        lastRunAt: null,
      },
      warnings: ["SOCIALFLOW_OWNER_SNAPSHOT_NEUTRAL_VALUES"],
    };

    const mapped = mapSocialFlowOwnerSnapshotToLegacyDashboard(response);

    expect(mapped.ownerSummary).toEqual({
      accountsConnected: 3,
      activeCampaigns: 5,
      scheduledPostsThisWeek: 7,
      recentEngagementScore: 0,
    });
    expect(mapped.conversionSummary.totalAppointmentsFromSocial).toBe(0);
    expect(mapped.conversionSummary.totalRevenueFromSocial).toBe(0);
    expect(mapped.conversionSummary.topCampaigns).toEqual([]);
  });

  it("does not import forbidden modules", () => {
    const source = readFileSync(
      "src/lib/capabilities/internal-api-clients/socialflow-owner.ts",
      "utf8",
    );

    expect(source).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(source).not.toContain("@/lib/socialflow/contracts/campobase");
    expect(source).not.toContain("@/lib/campobase/socialflow-service");
  });
});
