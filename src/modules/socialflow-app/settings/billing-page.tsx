import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";

export default async function SocialFlowBillingSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">Socialcors billing</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Billing boundary pending product-native wiring</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Billing can no longer read Campamento Base helpers from the Socialcors runtime. This page now
          remains explicit about that boundary instead of silently traversing another product surface.
        </p>
      </div>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Unavailable in isolated runtime</div>
        <p className="mt-3 leading-6">
          Product billing for tenant <strong>{session.tenantId}</strong> still needs a Socialcors-native portal and
          read model. This route fails closed until that wiring exists behind the product boundary.
        </p>
      </section>
    </div>
  );
}
