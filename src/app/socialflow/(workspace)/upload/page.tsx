import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getUploadBatchLimit } from "@/lib/socialflow/billing/enforce";
import { getEmployeesByTenant } from "@/lib/socialflow/employees/repository";
import UploadToPost from "@/components/socialflow/upload-to-post";

const SAAS_ID = "socialflow";

export default async function SocialFlowUploadPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const maxImages = await getUploadBatchLimit(session.tenantId, session.role).catch(() => 8);
  const employees = session.accountType === "empresa"
    ? (await getEmployeesByTenant(session.tenantId, SAAS_ID)).filter((e) => e.active)
    : [];

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          Socialcors · Analizar y publicar con IA
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          Analizar y publicar con IA
        </h1>
        <p className="mt-2 text-sm font-semibold text-violet-300">
          La IA hace el resto
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-white/50">
          Sube tus fotos o videos y la IA decide el formato, genera el caption, hashtags y hora de publicación automáticamente.
        </p>
      </div>

      <UploadToPost
        saasId={SAAS_ID}
        maxImages={maxImages}
        accountType={session.accountType}
        employees={employees}
      />
    </div>
  );
}
