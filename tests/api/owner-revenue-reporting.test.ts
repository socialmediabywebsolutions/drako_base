import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireOwnerAccess: vi.fn(),
  queryAll: vi.fn(),
}));

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return {
    ...actual,
    requireOwnerAccess: mocks.requireOwnerAccess,
  };
});

vi.mock("@/lib/db", () => ({
  queryAll: mocks.queryAll,
}));

import { GET } from "@/app/api/owner/revenue/route";

describe("/api/owner/revenue canonical reporting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireOwnerAccess.mockResolvedValue({
      tenantId: "tenant_owner",
      role: "owner",
    });
  });

  it("keeps the response shape while aggregating canonical statuses", async () => {
    mocks.queryAll.mockResolvedValue([
      { saas_slug: "drako", status: "active", count: 2, mrr_cents: 5000 },
      { saas_slug: "drako", status: "trialing", count: 1, mrr_cents: 2500 },
      { saas_slug: "drako", status: "past_due", count: 1, mrr_cents: 2500 },
      { saas_slug: "drako", status: "canceled", count: 1, mrr_cents: 0 },
      { saas_slug: "socialflow", status: "incomplete", count: 1, mrr_cents: 0 },
    ]);

    const response = await GET(new Request("https://drako.systems/api/owner/revenue"));

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      data: {
        global_mrr_cents: number;
        global_active_tenants: number;
        global_churn_rate: number;
        breakdown: Record<string, {
          total_tenants: number;
          active_tenants: number;
          mrr_cents: number;
          past_due_count: number;
          churn_rate: number;
          status_breakdown: Record<string, number>;
        }>;
      };
      timestamp: string;
    };

    expect(payload.ok).toBe(true);
    expect(payload.data).toEqual({
      global_mrr_cents: 10000,
      global_active_tenants: 4,
      global_churn_rate: 0.2,
      breakdown: {
        drako: {
          total_tenants: 5,
          active_tenants: 3,
          mrr_cents: 10000,
          past_due_count: 1,
          churn_rate: 0.2,
          status_breakdown: {
            active: 2,
            trialing: 1,
            past_due: 1,
            canceled: 1,
          },
        },
        socialflow: {
          total_tenants: 1,
          active_tenants: 0,
          mrr_cents: 0,
          past_due_count: 0,
          churn_rate: 0,
          status_breakdown: {
            incomplete: 1,
          },
        },
      },
    });
    expect(typeof payload.timestamp).toBe("string");
  });

  it("queries verified canonical subscriptions without ambiguous latest-row inference", async () => {
    mocks.queryAll.mockResolvedValue([]);

    const response = await GET(new Request("https://drako.systems/api/owner/revenue"));

    expect(response.status).toBe(200);
    const sql = String(mocks.queryAll.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("FROM saas_subscriptions s");
    expect(sql).toContain("s.stripe_customer_id IS NOT NULL");
    expect(sql).toContain("s.stripe_subscription_id IS NOT NULL");
    expect(sql).toContain("p.is_active = 1");
    expect(sql).not.toContain("ORDER BY");
    expect(sql).not.toContain("LIMIT 1");
  });
});
