import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCloudflareContextSafeSync = vi.hoisted(() => vi.fn());
vi.mock("@/lib/cloudflare/runtime", () => ({ getCloudflareContextSafeSync }));

import { resolveSocialCorsTransport, SOCIALCORS_DEFAULT_INTERNAL_ORIGIN } from "@/lib/capabilities/internal-api-clients/socialcors-transport";
import { fetchSocialFlowOwnerSnapshot } from "@/lib/capabilities/internal-api-clients/socialflow-owner";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

const ownerSnapshotBody = {
  service: "socialflow",
  runtime: "socialcors",
  timestamp: "2026-10-09T10:00:00.000Z",
  requestId: "req-1",
  tenantId: null,
  snapshot: { status: "ok", activeCampaigns: 1, scheduledPosts: 2, failedPostsLast24h: 0, connectedProfiles: 1, lastRunAt: null },
  warnings: [],
};

describe("SocialCors internal transport (holding → SocialCors)", () => {
  beforeEach(() => {
    getCloudflareContextSafeSync.mockReturnValue(null);
    vi.stubEnv("SOCIALFLOW_INTERNAL_SERVICE_TOKEN", "svc-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the SOCIALCORS_INTERNAL service binding when the holding Worker has it", async () => {
    const bindingFetch = vi.fn(async () => Response.json(ownerSnapshotBody));
    getCloudflareContextSafeSync.mockReturnValue({ env: { SOCIALCORS_INTERNAL: { fetch: bindingFetch } } });

    const result = await fetchSocialFlowOwnerSnapshot({ requestId: "req-1" });

    expect(result.snapshot.activeCampaigns).toBe(1);
    expect(bindingFetch).toHaveBeenCalledTimes(1);
    const [url, init] = bindingFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${SOCIALCORS_DEFAULT_INTERNAL_ORIGIN}/api/internal/socialflow/owner/snapshot`);
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe("Bearer svc-token");
    expect(headers.get("X-Drako-Control-Plane")).toBe("campobase");
    expect(headers.get("X-Drako-Request-Id")).toBe("req-1");
  });

  it("falls back to the configured base URL without a binding", () => {
    const transport = resolveSocialCorsTransport({ resolveFallbackBaseUrl: () => "https://configured.example" });
    expect(transport.via).toBe("base_url");
    expect(transport.baseUrl).toBe("https://configured.example");
  });

  it("an explicit fetchImpl (tests) always wins", () => {
    getCloudflareContextSafeSync.mockReturnValue({ env: { SOCIALCORS_INTERNAL: { fetch: vi.fn() } } });
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const transport = resolveSocialCorsTransport({ fetchImpl, resolveFallbackBaseUrl: () => "https://x.example" });
    expect(transport.via).toBe("explicit");
    expect(transport.fetchImpl).toBe(fetchImpl);
  });
});

describe("service token validation", () => {
  beforeEach(() => {
    getCloudflareContextSafeSync.mockReturnValue(null);
    vi.stubEnv("SOCIALFLOW_INTERNAL_SERVICE_TOKEN", "correct-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function request(token: string) {
    return new Request("https://socialflows.drako.systems/api/internal/socialflow/health", {
      headers: { Authorization: `Bearer ${token}`, "X-Drako-Control-Plane": "campobase", "X-Drako-Request-Id": "r" },
    });
  }

  it.each(["correct-tokeN", "correct-token-extra", "correct", ""])("rejects %j", (token) => {
    const result = validateInternalServiceTokenRequest(request(token));
    expect(result.ok).toBe(false);
  });

  it("accepts the exact token", () => {
    expect(validateInternalServiceTokenRequest(request("correct-token")).ok).toBe(true);
  });
});
