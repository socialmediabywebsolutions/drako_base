import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getUploadBatchLimit, getCarouselSlideLimit } from "@/lib/socialflow/billing/enforce";
import PublicarSelector from "@/components/socialflow/publicar-selector";

const SAAS_ID = "socialflow";

export default async function SocialFlowPublicarPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const [maxImages, maxCarouselSlides] = await Promise.all([
    getUploadBatchLimit(session.tenantId, session.role).catch(() => 8),
    getCarouselSlideLimit(session.tenantId, session.role).catch(() => 2),
  ]);

  return <PublicarSelector saasId={SAAS_ID} maxImages={maxImages} maxCarouselSlides={maxCarouselSlides} />;
}
