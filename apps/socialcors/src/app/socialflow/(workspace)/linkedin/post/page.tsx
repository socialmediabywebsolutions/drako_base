import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import LinkedInPostCreator from "@/components/socialflow/linkedin-post-creator";

const SAAS_ID = "socialflow";

export default async function SocialFlowLinkedInPostPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return (
    <div className="space-y-6">
      <Link
        href="/socialflow"
        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition hover:text-gray-900"
      >
        <span aria-hidden>←</span> Volver
      </Link>
      <LinkedInPostCreator saasId={SAAS_ID} />
    </div>
  );
}
