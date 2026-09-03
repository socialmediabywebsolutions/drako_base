import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getUploadBatchLimit } from "@/lib/socialflow/billing/enforce";
import { getEmployeesByTenant } from "@/lib/socialflow/employees/repository";
import UploadToPost from "@/components/socialflow/upload-to-post";

const SAAS_ID = "socialflow";

export default async function SocialFlowPublicarPostPage() {
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
      <Link
        href="/socialflow/publicar"
        className="flex items-center gap-1.5 text-sm font-medium text-white/50 transition hover:text-white"
      >
        <span aria-hidden>←</span> Volver
      </Link>
      <Suspense fallback={null}>
        <UploadToPost
          saasId={SAAS_ID}
          maxImages={maxImages}
          contentType="FEED"
          accountType={session.accountType}
          employees={employees}
        />
      </Suspense>
    </div>
  );
}
