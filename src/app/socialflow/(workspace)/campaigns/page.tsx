import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { listSaasSocialCampaigns, resolveSocialContext } from "@/lib/socialflow/repository";
import CampaignsBoard from "@/components/socialflow/campaigns-board";

const SAAS_ID = "socialflow";

export default async function SocialFlowCampaignsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
  const campaigns = await listSaasSocialCampaigns(ctx);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Socialcors · Campañas</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Campañas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Organiza tus campañas, revisa los posts que la IA genera en borrador y decide cuáles publicar.
        </p>
      </div>

      <CampaignsBoard campaigns={campaigns} saasId={SAAS_ID} />
    </div>
  );
}
