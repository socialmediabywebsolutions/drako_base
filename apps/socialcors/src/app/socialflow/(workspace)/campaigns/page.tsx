import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { listSaasSocialCampaigns, resolveSocialContext } from "@/lib/socialflow/repository";
import { getUploadBatchLimit } from "@/lib/socialflow/billing/enforce";
import CampaignsBoard from "@/components/socialflow/campaigns-board";

const SAAS_ID = "socialflow";

export default async function SocialFlowCampaignsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
  const [campaigns, maxImages] = await Promise.all([
    listSaasSocialCampaigns(ctx),
    getUploadBatchLimit(session.tenantId, session.role).catch(() => 8),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Socialcors · Campañas</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Campañas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Organiza tus campañas, revisa los posts que la IA genera en borrador y decide cuáles publicar.
        </p>
      </div>

      <CampaignsBoard campaigns={campaigns} saasId={SAAS_ID} maxImages={maxImages} />
    </div>
  );
}
