import { redirect } from "next/navigation";
import AccountSettingsClient from "./_components/account-settings-client";
import { getCurrentSocialFlowSession } from "../../../../../lib/auth/session";

function mapRole(role: "admin" | "user"): "ADMIN" | "MEMBER" {
  return role === "admin" ? "ADMIN" : "MEMBER";
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
          SocialFlow now resolves this workspace from the product auth boundary only, without using Campo Base session state.
        </p>
      </div>

      <AccountSettingsClient
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
      />
    </div>
  );
}
