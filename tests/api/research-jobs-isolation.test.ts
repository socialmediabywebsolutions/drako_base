import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(),
  requireTenantAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  ensureDatabase: mocks.ensureDatabase,
  queryAll: mocks.queryAll,
  queryOne: mocks.queryOne,
  run: mocks.run,
}));

vi.mock("@/lib/auth/session", () => ({
  requireTenantAccess: mocks.requireTenantAccess,
  UnauthorizedError: class UnauthorizedError extends Error {
    status = 401;
  },
}));

vi.mock("@/lib/http/errors", () => ({
  respondDatabaseError: () => null,
}));

vi.mock("@/lib/cf", () => ({
  env: () => ({ GOOGLE_PLACES_API_KEY: "test-key" }),
}));

import { GET, POST } from "@/app/api/research/jobs/route";

describe("/api/research/jobs isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantAccess.mockResolvedValue({ tenantId: "tenant_secure" });
    mocks.run.mockResolvedValue(true);
  });

  it("GET enforces tenant_id filter for session lookup", async () => {
    mocks.queryAll.mockResolvedValue([]);

    const request = new Request("https://drako.systems/api/research/jobs?sessionId=s_1");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const [sql, sessionId, tenantId] = mocks.queryAll.mock.calls[0];
    expect(String(sql)).toContain("AND tenant_id = ?");
    expect(sessionId).toBe("s_1");
    expect(tenantId).toBe("tenant_secure");
  });

  it("POST uses authenticated tenant and blocks foreign session ids", async () => {
    mocks.queryOne.mockResolvedValue(null);

    const request = new Request("https://drako.systems/api/research/jobs", {
      method: "POST",
      body: JSON.stringify({ sessionId: "foreign_session", address: "Madrid" }),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
