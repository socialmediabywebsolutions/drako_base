import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GET } from "@/app/api/internal/socialflow/owner/snapshot/route";

describe("GET /api/internal/socialflow/owner/snapshot", () => {
  beforeEach(() => {
    process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN_TEST = "test-service-token";
    delete process.env.SOCIALFLOW_INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_SERVICE_TOKEN;
    delete process.env.INTERNAL_API_SERVICE_TOKEN;
  });

  function buildRequest(headers?: HeadersInit) {
    return new Request("https://drako.systems/api/internal/socialflow/owner/snapshot", {
      method: "GET",
      headers,
    });
  }

  it("returns 200 with valid headers", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-owner-snapshot-200",
      "X-Drako-Tenant-Id": "tenant-1",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      service: string;
      runtime: string;
      timestamp: string;
      requestId: string;
      tenantId: string | null;
      snapshot: {
        status: string;
        activeCampaigns: number;
        scheduledPosts: number;
        failedPostsLast24h: number;
        connectedProfiles: number;
        lastRunAt: string | null;
      };
      warnings: string[];
    };

    expect(payload.service).toBe("socialflow");
    expect(payload.runtime).toBe("monolith");
    expect(typeof payload.timestamp).toBe("string");
    expect(payload.requestId).toBe("req-owner-snapshot-200");
    expect(payload.tenantId).toBe("tenant-1");
    expect(payload.snapshot.status).toBe("ok");
    expect(payload.snapshot.activeCampaigns).toBe(0);
    expect(payload.snapshot.scheduledPosts).toBe(0);
    expect(payload.snapshot.failedPostsLast24h).toBe(0);
    expect(payload.snapshot.connectedProfiles).toBe(0);
    expect(payload.snapshot.lastRunAt).toBeNull();
    expect(Array.isArray(payload.warnings)).toBe(true);
  });

  it("returns 401 without Authorization", async () => {
    const response = await GET(buildRequest({
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-no-auth",
    }));

    expect(response.status).toBe(401);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_UNAUTHORIZED");
  });

  it("returns 403 with invalid token", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer wrong-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-bad-token",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_FORBIDDEN");
  });

  it("returns 403 with invalid control plane", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "owner",
      "X-Drako-Request-Id": "req-bad-control-plane",
    }));

    expect(response.status).toBe(403);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_FORBIDDEN");
  });

  it("returns 400 without request id", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("INTERNAL_API_BAD_REQUEST");
  });

  it("returns response shape compatible with SocialFlowOwnerSnapshotResponse", async () => {
    const response = await GET(buildRequest({
      Authorization: "Bearer test-service-token",
      "X-Drako-Control-Plane": "campobase",
      "X-Drako-Request-Id": "req-shape",
    }));

    expect(response.status).toBe(200);
    const payload = await response.json() as Record<string, unknown>;

    expect(payload).toHaveProperty("service", "socialflow");
    expect(payload).toHaveProperty("runtime", "monolith");
    expect(payload).toHaveProperty("timestamp");
    expect(payload).toHaveProperty("requestId", "req-shape");
    expect(payload).toHaveProperty("tenantId", null);
    expect(payload).toHaveProperty("snapshot");
    expect(payload).toHaveProperty("warnings");

    const snapshot = payload.snapshot as Record<string, unknown>;
    expect(snapshot).toHaveProperty("status");
    expect(snapshot).toHaveProperty("activeCampaigns");
    expect(snapshot).toHaveProperty("scheduledPosts");
    expect(snapshot).toHaveProperty("failedPostsLast24h");
    expect(snapshot).toHaveProperty("connectedProfiles");
    expect(snapshot).toHaveProperty("lastRunAt");
  });

  it("does not import socialflow owner-dashboard contract and owner file now uses internal client", () => {
    const routeSource = readFileSync(
      "src/app/api/internal/socialflow/owner/snapshot/route.ts",
      "utf8",
    );
    expect(routeSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");

    const ownerControlDashboardSource = readFileSync(
      "src/lib/owner/control-dashboard.ts",
      "utf8",
    );
    expect(ownerControlDashboardSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(ownerControlDashboardSource).toContain("@/lib/capabilities/internal-api-clients/socialflow-owner");
  });
});
