import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getCarouselSlideLimit } from "@/lib/socialflow/billing/enforce";
import CarruselSelector from "@/components/socialflow/carrusel-selector";

const SAAS_ID = "socialflow";

export default async function SocialFlowCarruselSubirPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const maxSlides = await getCarouselSlideLimit(session.tenantId, session.role).catch(() => 2);

  return <CarruselSelector saasId={SAAS_ID} maxSlides={maxSlides} />;
}
