import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import KeywordDmAutomationPanel from "@/components/socialflow/keyword-dm-panel";

const SAAS_ID = "socialflow";

export default async function SocialFlowAutomatizacionesPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">
          Socialcors · Automatizaciones
        </p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-gray-900">
          Automatizaciones
        </h1>
        <p className="mt-1.5 max-w-xl text-sm text-gray-500">
          Configura respuestas automáticas por DM cuando alguien comenta una palabra clave en tus posts.
          Ideal para captar leads, enviar catálogos o responder preguntas frecuentes en piloto automático.
        </p>
      </div>

      {/* Panel de keyword DM triggers */}
      <KeywordDmAutomationPanel saasId={SAAS_ID} />
    </div>
  );
}
