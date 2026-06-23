import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { listSaasSocialAccounts, resolveSocialContext } from "@/lib/socialflow/repository";
import SocialFlowConnectedAccounts, { type ConnectedAccountSummary } from "@/components/settings/socialflow-connected-accounts";

const SOCIALFLOW_ACCOUNTS_SAAS_ID = "socialflow";

export default async function SocialFlowAccountsSettingsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SOCIALFLOW_ACCOUNTS_SAAS_ID });
  const accounts = await listSaasSocialAccounts(ctx);

  const summaries: ConnectedAccountSummary[] = accounts.map((account) => ({
    provider: account.provider,
    handle: account.handle,
    displayName: account.displayName,
    status: account.status,
    isPrimary: account.isPrimary,
    updatedAt: account.updatedAt,
  }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">SocialFlow · Cuentas</div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Cuentas conectadas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Conecta Instagram, Facebook y LinkedIn para que los motores de inteligencia de SocialFlow trabajen con datos reales.
        </p>
      </div>

      <SocialFlowConnectedAccounts accounts={summaries} saasId={SOCIALFLOW_ACCOUNTS_SAAS_ID} />
    </div>
  );
}
