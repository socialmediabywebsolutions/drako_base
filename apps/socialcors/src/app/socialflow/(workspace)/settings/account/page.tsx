import SocialFlowAccountSettings from "@/components/settings/socialflow-account-settings";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getSocialFlowPlanDefinition, resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import { redirect } from "next/navigation";

function mapRole(role: "owner" | "admin" | "user"): "ADMIN" | "MEMBER" {
  return role === "admin" || role === "owner" ? "ADMIN" : "MEMBER";
}

const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  trialing: "Prueba",
  trial: "Prueba",
  past_due: "Pago vencido",
  unpaid: "Sin pagar",
  canceled: "Cancelado",
  incomplete: "Incompleto",
  incomplete_expired: "Expirado",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default async function SocialFlowAccountSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const snapshot = await getCanonicalBillingSnapshot({ tenantId: session.tenantId, saasSlug: "socialflow" });
  const planCode = resolveSocialFlowPlanCode(snapshot.subscription);
  const planDefinition = getSocialFlowPlanDefinition(planCode);
  const billingStatus = snapshot.subscription.status
    ? STATUS_LABELS[snapshot.subscription.status] ?? snapshot.subscription.status
    : "Plan gratuito";
  const periodEndLabel = formatDate(snapshot.subscription.currentPeriodEnd);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Socialcors · Cuenta</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Identidad y workspace activo</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Socialcors resuelve este workspace directamente desde el perímetro de autenticación del producto, sin depender del estado de sesión de Campamento Base.
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
          tenantName: session.name ?? "Socialcors workspace",
          tenantSlug: "socialflow",
          plan: planDefinition.label,
          billingStatus,
          onboardingProgress: 100,
          periodEndLabel,
          cancelAtPeriodEnd: snapshot.subscription.cancelAtPeriodEnd,
        }}
        memberships={[{
          tenantId: session.tenantId,
          tenantName: session.name ?? "Socialcors workspace",
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
