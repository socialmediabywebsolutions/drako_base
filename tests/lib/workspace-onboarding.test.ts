import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryAll, queryOne, run } = vi.hoisted(() => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryAll,
  queryOne,
  run,
}));

import { refreshTenantOnboardingState } from "@/lib/auth/campamento-core";

describe("refreshTenantOnboardingState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    run.mockResolvedValue(true);
  });

  it("marks connect_product complete when the tenant already has an active SaaS", async () => {
    queryOne
      .mockResolvedValueOnce({
        tenant_id: "tenant_1",
        step: "invite_team",
        completed_steps: JSON.stringify(["create_workspace", "invite_team"]),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        tenant_id: "tenant_1",
        step: "invite_team",
        completed_steps: JSON.stringify(["create_workspace", "invite_team"]),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        tenant_id: "tenant_1",
        step: "activate_subscription",
        completed_steps: JSON.stringify(["create_workspace", "invite_team", "connect_product"]),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    queryAll.mockResolvedValueOnce([
      { id: "saas_1", slug: "socialflow", name: "SocialFlow", status: "active" },
    ]);

    const onboarding = await refreshTenantOnboardingState("tenant_1");

    expect(onboarding.completedSteps).toContain("connect_product");
  });
});
