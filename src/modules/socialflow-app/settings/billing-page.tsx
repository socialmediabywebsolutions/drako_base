import { redirect } from "next/navigation";
import BillingSettings from "@/components/settings/billing-settings";
import { ensureTenantBilling } from "@/lib/auth/campamento-core";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";

export default async function SocialFlowBillingSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const billing = await ensureTenantBilling(session.tenantId);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow billing</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Plan, subscription status and Stripe access</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Billing remains scoped by tenant, but access now enters from the SocialFlow auth boundary instead of Campo Base auth.
        </p>
      </div>
      <BillingSettings
        plan={billing?.plan ?? "STARTER"}
        status={billing?.status ?? "inactive"}
        currentPeriodEnd={billing?.currentPeriodEnd ?? null}
        stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
      />
    </div>
  );
}
