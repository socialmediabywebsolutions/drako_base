import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import { resolveNetworkEntitlements } from "@/lib/socialflow/billing/network-entitlements";
import { isLinkedInConnectEnabled } from "@/lib/socialflow/linkedin/core";
import SocialNetworksBoard, {
  type ConnectedAccountSummary,
  type SocialNetworkCardModel,
} from "@/components/socialflow/social-networks-board";

const SOCIALFLOW_REDES_SAAS_ID = "socialflow";
const SOCIALFLOW_REDES_PATH = "/socialflow/redes";

export default async function SocialFlowRedesPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SOCIALFLOW_REDES_SAAS_ID });
  const accounts = await listSaasSocialAccounts(ctx);
  const summaries: ConnectedAccountSummary[] = accounts.map((account) => ({
    provider: account.provider,
    handle: account.handle,
    displayName: account.displayName,
    status: account.status,
    isPrimary: account.isPrimary,
    updatedAt: account.updatedAt,
  }));

  const entitlements = await resolveNetworkEntitlements({ tenantId: session.tenantId, saasId: SOCIALFLOW_REDES_SAAS_ID });
  const linkedInAvailable = isLinkedInConnectEnabled();
  const isEmpresa = entitlements.accountType === "empresa";

  const networks: SocialNetworkCardModel[] = isEmpresa
    ? [
        {
          key: "INSTAGRAM",
          connectPath: "/api/socialflow/oauth/instagram/connect",
          comingSoon: false,
          entitlement: entitlements.included.has("INSTAGRAM") ? "included" : "extra",
          description: "Conecta una cuenta de Instagram Business para publicar contenido y ver métricas de engagement.",
        },
        {
          key: "FACEBOOK_PAGE",
          connectPath: "/api/socialflow/meta/connect",
          comingSoon: false,
          entitlement: entitlements.included.has("FACEBOOK_PAGE") ? "included" : "extra",
          description: "Conecta una Página de Facebook para obtener seguidores, engagement y publicaciones recientes.",
        },
        {
          key: "LINKEDIN",
          connectPath: linkedInAvailable ? "/api/socialflow/linkedin/connect" : null,
          comingSoon: !linkedInAvailable,
          entitlement: entitlements.included.has("LINKEDIN") ? "included" : "extra",
          description: "Conecta la Company Page de LinkedIn de tu empresa para publicar como marca.",
        },
        {
          key: "TIKTOK",
          connectPath: null,
          comingSoon: true,
          entitlement: entitlements.included.has("TIKTOK") ? "included" : "extra",
          description: "Publica directamente en TikTok desde Socialcors.",
        },
        {
          key: "YOUTUBE",
          connectPath: null,
          comingSoon: true,
          entitlement: "extra",
          description: "Publica Shorts y vídeos directamente en tu canal de YouTube.",
        },
      ]
    : [
        {
          key: "INSTAGRAM",
          connectPath: "/api/socialflow/oauth/instagram/connect",
          comingSoon: false,
          entitlement: entitlements.included.has("INSTAGRAM") ? "included" : "extra",
          description: "Conecta una cuenta de Instagram Business para publicar contenido y ver métricas de engagement.",
        },
        {
          key: "TIKTOK",
          connectPath: null,
          comingSoon: true,
          entitlement: entitlements.included.has("TIKTOK") ? "included" : "extra",
          description: "Publica directamente en TikTok desde Socialcors.",
        },
        {
          key: "FACEBOOK_PAGE",
          connectPath: "/api/socialflow/meta/connect",
          comingSoon: false,
          entitlement: entitlements.included.has("FACEBOOK_PAGE") ? "included" : "extra",
          description: "Conecta una Página de Facebook para obtener seguidores, engagement y publicaciones recientes.",
        },
        {
          key: "LINKEDIN",
          connectPath: linkedInAvailable ? "/api/socialflow/linkedin/connect" : null,
          comingSoon: !linkedInAvailable,
          entitlement: entitlements.included.has("LINKEDIN") ? "included" : "extra",
          description: "Conecta tu perfil personal de LinkedIn para publicar contenido y hacer crecer tu marca personal.",
        },
        {
          key: "YOUTUBE",
          connectPath: null,
          comingSoon: true,
          entitlement: "extra",
          description: "Publica Shorts y vídeos directamente en tu canal de YouTube.",
        },
      ];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Socialcors · Mis Redes</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">Mis Redes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
          Conecta y gestiona las redes sociales disponibles para tu plan.
        </p>
      </div>

      <SocialNetworksBoard
        networks={networks}
        accounts={summaries}
        saasId={SOCIALFLOW_REDES_SAAS_ID}
        redirectTo={SOCIALFLOW_REDES_PATH}
      />
    </div>
  );
}
