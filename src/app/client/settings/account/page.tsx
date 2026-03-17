import { redirect } from "next/navigation";
import AccountSettings from "@/components/settings/account-settings";
import { getCurrentTenant, getCurrentUser } from "@/lib/auth/server";

export default async function AccountSettingsPage() {
  const currentUser = await getCurrentUser();
  const currentTenant = await getCurrentTenant();
  if (!currentUser || !currentTenant) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Workspace account</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Identity, session and workspace access</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Manage the authenticated operator identity, review the active workspace and switch between memberships without leaving Campamento Base.
        </p>
      </div>
      <AccountSettings
        user={{
          name: currentUser.name,
          email: currentUser.email,
          currentTenantId: currentUser.tenantId,
          role: currentUser.role,
        }}
        workspace={{
          tenantName: currentTenant.tenant.name,
          tenantSlug: currentTenant.tenant.slug,
          plan: currentTenant.billing?.plan ?? "STARTER",
          billingStatus: currentTenant.billing?.status ?? "inactive",
          onboardingProgress: currentTenant.onboardingSummary.progress,
        }}
        memberships={currentUser.memberships.map((membership) => ({
          tenantId: membership.tenantId,
          tenantName: membership.tenantName,
          tenantSlug: membership.tenantSlug,
          role: membership.role,
        }))}
      />
    </div>
  );
}
