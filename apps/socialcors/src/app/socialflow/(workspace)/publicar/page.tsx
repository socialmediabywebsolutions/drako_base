import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getUploadBatchLimit } from "@/lib/socialflow/billing/enforce";
import PublicarSelector from "@/components/socialflow/publicar-selector";

const SAAS_ID = "socialflow";

export default async function SocialFlowPublicarPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const maxImages = await getUploadBatchLimit(session.tenantId, session.role).catch(() => 8);

  return <PublicarSelector saasId={SAAS_ID} maxImages={maxImages} />;
}
