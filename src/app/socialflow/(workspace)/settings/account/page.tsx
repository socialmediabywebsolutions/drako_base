import SocialFlowAccountSettings from "@/components/settings/socialflow-account-settings";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { redirect } from "next/navigation";

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
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow · Cuenta</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Identidad y workspace activo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          SocialFlow resuelve este workspace directamente desde el perímetro de autenticación del producto, sin depender del estado de sesión de Campamento Base.
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
