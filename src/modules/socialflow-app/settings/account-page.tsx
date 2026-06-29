/**
 * @deprecated Legacy module - moved to src/app/socialflow/(workspace)/settings/account/page.tsx
 * This file is kept for backward compatibility only.
 */
import SocialFlowAccountSettings from "@/components/settings/socialflow-account-settings";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { redirect } from "next/navigation";

function mapRole(role: "owner" | "admin" | "user"): "ADMIN" | "MEMBER" {
  return role === "admin" || role === "owner" ? "ADMIN" : "MEMBER";
}

export default async function SocialFlowAccountSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow account</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Product identity and active workspace</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          SocialFlow now resolves this workspace from the product auth boundary only, without using Campamento Base session state.
        </p>
      </div>
      <SocialFlowAccountSettings
        user={{
          name: session.name,
          email: session.email,
          currentTenantId: session.tenantId,
          role: mapRole(session.role),
        }}
        workspace={{
          tenantName: session.name ?? "SocialFlow workspace",
          tenantSlug: "socialflow",
          plan: "STARTER",
          billingStatus: "isolated",
          onboardingProgress: 100,
        }}
        memberships={[{
          tenantId: session.tenantId,
          tenantName: session.name ?? "SocialFlow workspace",
          tenantSlug: "socialflow",
          role: mapRole(session.role),
        }]}
        allowWorkspaceSwitch={false}
        logoutEndpoint="/api/socialflow/auths/logouts"
        logoutRedirectTo="/socialflow/auth"
        sessionLabel="isolated socialflow session"
      />
    </div>
  );
}
