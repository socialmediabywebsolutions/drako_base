import { redirect } from "next/navigation";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getSocialFlowPlanDefinition, listSocialFlowPaidPlans, resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import SocialFlowBillingSettings from "@/components/socialflow/settings/socialflow-billing-settings";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SocialFlowBillingSettingsPage({ searchParams }: PageProps) {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const params = await searchParams;
  const billingParam = typeof params.billing === "string" ? params.billing : null;

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

      {/* Feedback post-checkout */}
      {billingParam === "success" && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <span className="mt-0.5 text-emerald-500">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M22 4L12 14.01l-3-3" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold text-emerald-800">¡Plan activado correctamente!</p>
            <p className="mt-0.5 text-xs text-emerald-700">Tu suscripción está activa. Puedes empezar a usar todas las funciones de tu plan ahora mismo.</p>
          </div>
        </div>
      )}
      {billingParam === "cancelled" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <span className="mt-0.5 text-amber-500">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-bold text-amber-800">Pago cancelado</p>
            <p className="mt-0.5 text-xs text-amber-700">No se realizó ningún cargo. Puedes elegir un plan cuando quieras.</p>
          </div>
        </div>
      )}

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
