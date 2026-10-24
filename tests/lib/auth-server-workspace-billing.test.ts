import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  isLocalDemoEnabled: vi.fn(),
  listUserMemberships: vi.fn(),
  resolveActiveMembershipForUser: vi.fn(),
  resolveWorkspaceTenant: vi.fn(),
  refreshTenantOnboardingState: vi.fn(),
  getTenantBilling: vi.fn(),
  listConnectedWorkspaceProducts: vi.fn(),
  getDefaultTenantBillingRecord: vi.fn(),
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: mocks.cookies,
}));

vi.mock("@/lib/platform/surfaces", () => ({
  isLocalDemoEnabled: mocks.isLocalDemoEnabled,
}));

vi.mock("@/lib/auth/campamento-core", () => ({
  getDefaultWorkspaceTenantId: vi.fn(),
  getDefaultTenantBillingRecord: mocks.getDefaultTenantBillingRecord,
  getTenantBilling: mocks.getTenantBilling,
  listUserMemberships: mocks.listUserMemberships,
  listConnectedWorkspaceProducts: mocks.listConnectedWorkspaceProducts,
  refreshTenantOnboardingState: mocks.refreshTenantOnboardingState,
  resolveActiveMembershipForUser: mocks.resolveActiveMembershipForUser,
  resolveWorkspaceTenant: mocks.resolveWorkspaceTenant,
  summarizeOnboarding: vi.fn((record) => ({
    progress: 25,
    nextStep: "activate_subscription",
    completedCount: record.completedSteps.length,
    totalSteps: 4,
  })),
}));

describe("getCurrentTenant workspace billing reads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.isLocalDemoEnabled.mockReturnValue(false);
    mocks.getServerSession.mockResolvedValue({
      user: {
        id: "user_1",
        email: "owner@workspace.test",
        tenantId: "tenant_alpha",
        name: "Owner",
      },
    });
    mocks.listUserMemberships.mockResolvedValue([
      {
        id: "membership_1",
        tenantId: "tenant_alpha",
        userId: "user_1",
        email: "owner@workspace.test",
        role: "OWNER",
        tenantName: "Workspace",
        tenantSlug: "workspace",
        tenantPlan: "starter",
        tenantStatus: "active",
        createdAt: "2026-04-01T00:00:00.000Z",
      },
    ]);
    mocks.resolveActiveMembershipForUser.mockResolvedValue({
      id: "membership_1",
      tenantId: "tenant_alpha",
      userId: "user_1",
      email: "owner@workspace.test",
      role: "OWNER",
      tenantName: "Workspace",
      tenantSlug: "workspace",
      tenantPlan: "starter",
      tenantStatus: "active",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    mocks.resolveWorkspaceTenant.mockResolvedValue({
      id: "tenant_alpha",
      name: "Workspace",
      slug: "workspace",
      plan: "starter",
      status: "active",
      createdBy: "user_1",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    mocks.refreshTenantOnboardingState.mockResolvedValue({
      tenantId: "tenant_alpha",
      step: "activate_subscription",
      completedSteps: ["create_workspace"],
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    mocks.listConnectedWorkspaceProducts.mockResolvedValue([]);
  });

  it("uses existing tenant billing without bootstrap writes", async () => {
    mocks.getTenantBilling.mockResolvedValue({
      tenantId: "tenant_alpha",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      plan: "PRO",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });

    const { getCurrentTenant } = await import("@/lib/auth/server");
    const result = await getCurrentTenant();

    expect(result?.billing).toEqual({
      tenantId: "tenant_alpha",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      plan: "PRO",
      status: "active",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    expect(mocks.getDefaultTenantBillingRecord).not.toHaveBeenCalled();
  });

  it("falls back to a default workspace billing snapshot when no row exists", async () => {
    mocks.getTenantBilling.mockResolvedValue(null);
    mocks.getDefaultTenantBillingRecord.mockReturnValue({
      tenantId: "tenant_alpha",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      plan: "STARTER",
      status: "inactive",
      currentPeriodEnd: null,
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });

    const { getCurrentTenant } = await import("@/lib/auth/server");
    const result = await getCurrentTenant();

    expect(result?.billing).toEqual({
      tenantId: "tenant_alpha",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      plan: "STARTER",
      status: "inactive",
      currentPeriodEnd: null,
      createdAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    });
    expect(mocks.getDefaultTenantBillingRecord).toHaveBeenCalledWith("tenant_alpha");
  });
});
