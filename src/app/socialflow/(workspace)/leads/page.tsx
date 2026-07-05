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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          Socialcors · Oportunidades
        </p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white">
          Oportunidades
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-white/50">
          Seguidores con intención de colaborar o contratarte, detectados automáticamente de comentarios y DMs.
          {hotCount > 0 && (
            <span className="ml-1 font-semibold text-fuchsia-400">
              {hotCount} HOT{hotCount !== 1 ? "s" : ""} ahora.
            </span>
          )}
        </p>
      </div>

      <LeadsPanel leads={leads} saasId={SAAS_ID} />
    </div>
  );
}
