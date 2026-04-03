import { cookies, headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  type WorkspaceMembershipRecord,
  type WorkspaceConnectedProductRecord,
  type WorkspaceRole,
  type WorkspaceTenantRecord,
  getDefaultTenantBillingRecord,
  getDefaultWorkspaceTenantId,
  getTenantBilling,
  listUserMemberships,
  listConnectedWorkspaceProducts,
  refreshTenantOnboardingState,
  resolveActiveMembershipForUser,
  resolveWorkspaceTenant,
  summarizeOnboarding,
} from "@/lib/auth/campamento-core";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { isLocalDemoEnabled } from "@/lib/platform/surfaces";

export type CurrentWorkspaceUser = {
  id: string;
  email: string;
  name: string | null;
  tenantId: string;
  role: WorkspaceRole;
  memberships: WorkspaceMembershipRecord[];
};

export type CurrentWorkspaceTenant = {
  tenant: WorkspaceTenantRecord;
  membership: WorkspaceMembershipRecord;
  onboarding: Awaited<ReturnType<typeof refreshTenantOnboardingState>>;
  onboardingSummary: ReturnType<typeof summarizeOnboarding>;
  billing: Awaited<ReturnType<typeof getTenantBilling>>;
  connectedProducts: WorkspaceConnectedProductRecord[];
};

function roleWeight(role: WorkspaceRole): number {
  if (role === "OWNER") return 3;
  if (role === "ADMIN") return 2;
  return 1;
}

export async function getCurrentUser(): Promise<CurrentWorkspaceUser | null> {
  if (isLocalDemoEnabled()) {
    const headerStore = await headers();
    const cookieStore = await cookies();
    const hasSessionCookie = cookieStore.get("next-auth.session-token") || cookieStore.get("__Secure-next-auth.session-token");
    const localDemoHeader = headerStore.get("x-drako-client-entry-mode");
    if (!hasSessionCookie && localDemoHeader === "local_demo") {
      return {
        id: "local-demo-user",
        email: "demo@drako.systems",
        name: "Local Demo",
        tenantId: process.env.DRAKO_CLIENT_DEMO_TENANT_ID ?? DEMO_TENANT_ID,
        role: "OWNER",
        memberships: [
          {
            id: "membership_demo",
            tenantId: process.env.DRAKO_CLIENT_DEMO_TENANT_ID ?? DEMO_TENANT_ID,
            userId: "local-demo-user",
            email: "demo@drako.systems",
            role: "OWNER",
            tenantName: "Demo Workspace",
            tenantSlug: "demo",
            tenantPlan: "starter",
            tenantStatus: "active",
            createdAt: new Date().toISOString(),
          },
        ],
      };
    }
  }

  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  if (!sessionUser?.id || !sessionUser.email) return null;
  const memberships = await listUserMemberships(sessionUser.id);
  const active = memberships.find((item) => item.tenantId === sessionUser.tenantId) ?? memberships[0] ?? null;
  if (!active) return null;
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name ?? null,
    tenantId: active.tenantId,
    role: active.role,
    memberships,
  };
}

export async function getCurrentTenant(): Promise<CurrentWorkspaceTenant | null> {
  const user = await getCurrentUser();
  if (!user) {
    if (isLocalDemoEnabled()) {
      const tenantId = process.env.DRAKO_CLIENT_DEMO_TENANT_ID ?? (await getDefaultWorkspaceTenantId());
      return {
        tenant: {
          id: tenantId,
          name: "Demo Workspace",
          slug: "demo",
          plan: "starter",
          status: "active",
          createdBy: null,
          createdAt: new Date().toISOString(),
        },
        membership: {
          id: "membership_demo",
          tenantId,
          userId: "local-demo-user",
          email: "demo@drako.systems",
          role: "OWNER",
          tenantName: "Demo Workspace",
          tenantSlug: "demo",
          tenantPlan: "starter",
          tenantStatus: "active",
          createdAt: new Date().toISOString(),
        },
        onboarding: {
          tenantId,
          step: "complete",
          completedSteps: ["create_workspace", "invite_team", "connect_product", "activate_subscription"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        onboardingSummary: { progress: 100, nextStep: null, completedCount: 4, totalSteps: 4 },
        billing: {
          tenantId,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          plan: "STARTER",
          status: "demo",
          currentPeriodEnd: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        connectedProducts: [
          {
            id: "local_demo_socialflow",
            slug: "socialflow",
            name: "SocialFlow",
            status: "active",
          },
        ],
      };
    }
    return null;
  }
  const membership = (await resolveActiveMembershipForUser(user.id)) ?? user.memberships[0] ?? null;
  if (!membership) return null;
  const tenant = await resolveWorkspaceTenant(membership.tenantId);
  if (!tenant) return null;
  const onboarding = await refreshTenantOnboardingState(membership.tenantId);
  const billing = (await getTenantBilling(membership.tenantId)) ?? getDefaultTenantBillingRecord(membership.tenantId);
  const connectedProducts = await listConnectedWorkspaceProducts(membership.tenantId);
  return {
    tenant,
    membership,
    onboarding,
    onboardingSummary: summarizeOnboarding(onboarding),
    billing,
    connectedProducts,
  };
}

export async function requireRole(requiredRole: WorkspaceRole): Promise<CurrentWorkspaceUser> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new Error("UNAUTHORIZED");
  }
  if (roleWeight(currentUser.role) < roleWeight(requiredRole)) {
    throw new Error("FORBIDDEN");
  }
  return currentUser;
}
