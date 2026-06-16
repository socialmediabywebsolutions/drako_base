import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { listLeads, resolveSocialContext } from "@/lib/socialflow/leads/repository";
import LeadsPanel from "@/components/socialflow/leads-panel";

const SAAS_ID = "socialflow";

export default async function SocialFlowLeadsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
  const leads = await listLeads(ctx, { limit: 100 });

  const hotCount = leads.filter((l) => l.temperature === "HOT").length;
  const warmCount = leads.filter((l) => l.temperature === "WARM").length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">
          SocialFlow · Lead Intelligence
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Leads detectados
          {leads.length > 0 && (
            <span className="ml-3 text-xl font-semibold text-slate-400">({leads.length})</span>
          )}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Los leads se detectan automáticamente a partir de comentarios y DMs con señales de intención de compra.
          {hotCount > 0 && (
            <span className="ml-1 font-semibold text-rose-600">
              {hotCount} lead{hotCount !== 1 ? "s" : ""} HOT.
            </span>
          )}
          {warmCount > 0 && hotCount === 0 && (
            <span className="ml-1 font-semibold text-amber-600">
              {warmCount} lead{warmCount !== 1 ? "s" : ""} WARM.
            </span>
          )}
        </p>
      </div>

      <LeadsPanel leads={leads} saasId={SAAS_ID} />
    </div>
  );
}
