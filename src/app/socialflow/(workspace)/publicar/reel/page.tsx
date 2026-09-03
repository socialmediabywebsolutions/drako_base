import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getUploadBatchLimit } from "@/lib/socialflow/billing/enforce";
import PublishReel from "@/components/socialflow/publish-reel";

const SAAS_ID = "socialflow";

export default async function SocialFlowPublicarReelPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const maxImages = await getUploadBatchLimit(session.tenantId, session.role).catch(() => 8);

  return (
    <div className="space-y-6">
      <Link
        href="/socialflow/publicar"
        className="flex items-center gap-1.5 text-sm font-medium text-white/50 transition hover:text-white"
      >
        <span aria-hidden>←</span> Volver
      </Link>
      <Suspense fallback={null}>
        <PublishReel saasId={SAAS_ID} maxImages={maxImages} />
      </Suspense>
    </div>
  );
}
