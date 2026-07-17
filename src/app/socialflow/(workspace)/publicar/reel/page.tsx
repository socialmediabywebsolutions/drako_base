import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import PublishReel from "@/components/socialflow/publish-reel";

const SAAS_ID = "socialflow";

export default async function SocialFlowPublicarReelPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          Socialcors · Publicar
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          Reel
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Sube una foto y Socialcors crea tu Reel automáticamente.
        </p>
      </div>

      <PublishReel saasId={SAAS_ID} />
    </div>
  );
}
