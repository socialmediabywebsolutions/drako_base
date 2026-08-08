import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { listLeads, resolveSocialContext } from "@/lib/socialflow/leads/repository";
import { listFeedItems } from "@/lib/socialflow/intelligence/repository";
import LeadsPanel from "@/components/socialflow/leads-panel";
import IntelligenceFeedSection from "@/components/socialflow/intelligence-feed-section";

const SAAS_ID = "socialflow";

export default async function SocialFlowLeadsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
  const [leads, feedItems] = await Promise.all([
    listLeads(ctx, { limit: 100 }),
    listFeedItems(session.tenantId, SAAS_ID, { limit: 50 }).catch(() => []),
  ]);

  const alerts = feedItems.filter((item) => item.type === "alert");
  const opportunities = feedItems.filter((item) => item.type === "opportunity");

  const hotCount = leads.filter((l) => l.temperature === "HOT").length;
  const isEmpresa = session.accountType === "empresa";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          {isEmpresa ? "Socialcors · CRM Social" : "Socialcors · Oportunidades"}
        </p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white">
          {isEmpresa ? "CRM Social" : "Oportunidades"}
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-white/50">
          {isEmpresa
            ? "Clientes con intención de compra o consulta, detectados automáticamente en tus comentarios y mensajes."
            : "Seguidores con intención de colaborar o contratarte, detectados automáticamente de comentarios y DMs."}
          {hotCount > 0 && (
            <span className="ml-1 font-semibold text-fuchsia-400">
              {hotCount} HOT{hotCount !== 1 ? "s" : ""} ahora.
            </span>
          )}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-base font-bold text-white">🎯 Leads detectados</h2>
        <LeadsPanel leads={leads} saasId={SAAS_ID} accountType={session.accountType} />
      </section>

      <IntelligenceFeedSection
        title="Alertas del sistema"
        description="Fatiga de contenido detectada en tus últimos posts"
        icon="⚠️"
        items={alerts}
        emptyMessage="Sin alertas activas ahora mismo."
      />

      <IntelligenceFeedSection
        title="Oportunidades de nicho"
        description="Hooks y formatos con tracción real en tu nicho que aún no has probado"
        icon="💡"
        items={opportunities}
        emptyMessage="Sin oportunidades detectadas esta semana — vuelve a revisar tras el próximo análisis semanal."
      />
    </div>
  );
}
