import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import {
  listSaasSocialCampaigns,
  listSaasSocialPosts,
  resolveSocialContext,
} from "@/lib/socialflow/repository";
import EditorialCalendar from "@/components/socialflow/editorial-calendar";

const SAAS_ID = "socialflow";

export default async function SocialFlowPlanPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
  const [posts, campaigns] = await Promise.all([
    listSaasSocialPosts(ctx),
    listSaasSocialCampaigns(ctx),
  ]);

  const scheduled = posts.filter(p => p.status === "SCHEDULED" || p.status === "PUBLISHING").length;
  const backlog = posts.filter(
    p => !p.scheduledAt && !["POSTED", "PUBLISHED", "FAILED", "REJECTED"].includes(p.status)
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">
          SocialFlow · Plan editorial
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          Calendario
          {scheduled > 0 && (
            <span className="ml-3 text-xl font-semibold text-white/40">
              {scheduled} programado{scheduled !== 1 ? "s" : ""}
            </span>
          )}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
          Crea, aprueba y programa publicaciones desde un solo lugar.
          {backlog > 0 && (
            <span className="ml-1 font-semibold text-amber-400">
              {backlog} post{backlog !== 1 ? "s" : ""} sin programar.
            </span>
          )}
        </p>
      </div>

      <EditorialCalendar posts={posts} campaigns={campaigns} saasId={SAAS_ID} />
    </div>
  );
}
