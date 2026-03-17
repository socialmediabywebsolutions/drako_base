import { redirect } from "next/navigation";
import BillingSettings from "@/components/settings/billing-settings";
import { getCurrentTenant } from "@/lib/auth/server";

export default async function TenantBillingSettingsPage() {
  const current = await getCurrentTenant();
  if (!current) {
    redirect("/auth/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Workspace billing</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Plan, subscription status and Stripe access</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Campamento Base owns the commercial layer for the tenant workspace. Review the current plan, open checkout and manage Stripe self-service from here.
        </p>
      </div>
      <BillingSettings
        plan={current.billing?.plan ?? "STARTER"}
        status={current.billing?.status ?? "inactive"}
        currentPeriodEnd={current.billing?.currentPeriodEnd ?? null}
        stripeConfigured={Boolean(process.env.STRIPE_SECRET_KEY)}
      />
    </div>
  );
}
