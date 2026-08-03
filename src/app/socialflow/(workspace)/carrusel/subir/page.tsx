import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getCarouselSlideLimit } from "@/lib/socialflow/billing/enforce";
import PublishCarrusel from "@/components/socialflow/publish-carrusel";

const SAAS_ID = "socialflow";

export default async function SocialFlowCarruselSubirPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const maxSlides = await getCarouselSlideLimit(session.tenantId, session.role).catch(() => 2);

  return (
    <div className="space-y-6">
      <Link
        href="/socialflow/carrusel"
        className="flex items-center gap-1.5 text-sm font-medium text-white/50 transition hover:text-white"
      >
        <span aria-hidden>←</span> Volver
      </Link>
      <PublishCarrusel saasId={SAAS_ID} maxSlides={maxSlides} />
    </div>
  );
}
