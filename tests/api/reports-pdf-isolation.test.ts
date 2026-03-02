import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureDatabase: vi.fn(),
  queryOne: vi.fn(),
  requireTenantAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  ensureDatabase: mocks.ensureDatabase,
  queryOne: mocks.queryOne,
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

import { GET } from "@/app/api/reports/[id]/pdf/route";

describe("/api/reports/[id]/pdf isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters report fetch by tenant_id", async () => {
    mocks.requireTenantAccess.mockResolvedValue({ tenantId: "tenant_secure" });
    mocks.queryOne.mockResolvedValue({
      report_id: "report_1",
      mime_type: "application/pdf",
      content: btoa("fake-pdf"),
      type: "analysis",
    });

    const request = new Request("https://drako.systems/api/reports/report_1/pdf");
    const response = await GET(request, { params: Promise.resolve({ id: "report_1" }) });

    expect(response.status).toBe(200);
    expect(mocks.queryOne).toHaveBeenCalledTimes(1);
    const [sql, reportId, tenantId] = mocks.queryOne.mock.calls[0];
    expect(String(sql)).toContain("r.tenant_id = ?");
    expect(reportId).toBe("report_1");
    expect(tenantId).toBe("tenant_secure");
  });

  it("returns 404 for cross-tenant report access", async () => {
    mocks.requireTenantAccess.mockResolvedValue({ tenantId: "tenant_secure" });
    mocks.queryOne.mockResolvedValue(null);

    const request = new Request("https://drako.systems/api/reports/report_foreign/pdf");
    const response = await GET(request, { params: Promise.resolve({ id: "report_foreign" }) });

    expect(response.status).toBe(404);
    expect(mocks.queryOne).toHaveBeenCalledTimes(1);
    const [sql] = mocks.queryOne.mock.calls[0];
    expect(String(sql)).toContain("r.tenant_id = ?");
  });
});
