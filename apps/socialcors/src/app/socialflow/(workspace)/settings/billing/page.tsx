import { redirect } from "next/navigation";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getSocialFlowPlanDefinition, listSocialFlowPaidPlans, resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import SocialFlowBillingSettings from "@/components/socialflow/settings/socialflow-billing-settings";

export default async function SocialFlowBillingSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const snapshot = await getCanonicalBillingSnapshot({ tenantId: session.tenantId, saasSlug: "socialflow" });
  const planCode = resolveSocialFlowPlanCode(snapshot.subscription);
  const planDefinition = getSocialFlowPlanDefinition(planCode);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Socialcors · Facturación</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Plan y facturación</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Gestiona tu suscripción de Socialcors y actualiza tu plan cuando estés listo.
        </p>
      </div>

      <SocialFlowBillingSettings
        currentPlanCode={planCode}
        currentPlanLabel={planDefinition.label}
        status={snapshot.subscription.status}
        currentPeriodEnd={snapshot.subscription.currentPeriodEnd}
        cancelAtPeriodEnd={snapshot.subscription.cancelAtPeriodEnd}
        canManageBilling={Boolean(snapshot.subscription.stripeCustomerId)}
        paidPlans={listSocialFlowPaidPlans()}
      />
    </div>
  );
}
