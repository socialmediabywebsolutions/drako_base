import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getSocialInsightsSnapshot, resolveSocialContext, SocialContextError } from "@/lib/socialflow/repository";
import { getStyleHistory } from "@/lib/socialflow/intelligence/NicheIntelligenceService";
import { extractBestHourByFormat, type BestHourByFormat } from "@/lib/socialflow/ai/agents/BestTimeToPostAgent";
import { env } from "@/lib/cf";
import type { SocialInsightsSnapshot } from "@/lib/social-core/types";
import InsightsSummaryCards from "./_components/InsightsSummaryCards";
import ReachByFormatChart from "./_components/ReachByFormatChart";
import LikesCommentsByFormatChart from "./_components/LikesCommentsByFormatChart";
import PlaysByFormatChart from "./_components/PlaysByFormatChart";
import FollowerGrowthChart from "./_components/FollowerGrowthChart";
import BestTimeToPostCard from "./_components/BestTimeToPostCard";
import TopPostsList from "./_components/TopPostsList";

const SAAS_ID = "socialflow";

export default async function SocialFlowInsightsPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  let insights: SocialInsightsSnapshot | null = null;
  try {
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: SAAS_ID });
    insights = await getSocialInsightsSnapshot(ctx);
  } catch (error) {
    if (!(error instanceof SocialContextError)) {
      console.error("SOCIALFLOW_INSIGHTS_PAGE_ERROR", error);
    }
  }

  let bestHourByFormat: BestHourByFormat | null = null;
  try {
    const dracoEnv = env();
    if (dracoEnv) {
      const styleHistory = await getStyleHistory(session.tenantId, SAAS_ID, dracoEnv);
      bestHourByFormat = styleHistory[0] ? extractBestHourByFormat(styleHistory[0].snapshotJson) : null;
    }
  } catch (error) {
    console.error("SOCIALFLOW_INSIGHTS_BEST_TIME_ERROR", error);
  }

  return (
    <div className="space-y-7">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Socialcors · Insights</p>
        <h1 className="mt-1.5 text-2xl font-black tracking-tight text-white">Insights</h1>
        <p className="mt-1.5 max-w-xl text-sm text-white/50">
          Rendimiento real de tus redes: alcance, guardados, seguidores y tu mejor contenido de los últimos 30 días.
        </p>
      </div>

      {insights ? (
        <>
          <InsightsSummaryCards summary={insights.summary} />

          <section>
            <h2 className="mb-3 text-base font-bold text-white">Alcance por formato (últimas 4 semanas)</h2>
            <ReachByFormatChart data={insights.weeklyFormatBreakdown} />
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold text-white">Likes + comentarios por formato (últimas 4 semanas)</h2>
            <LikesCommentsByFormatChart data={insights.engagementByFormatBreakdown} />
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold text-white">Visualizaciones por formato (últimas 4 semanas)</h2>
            <PlaysByFormatChart data={insights.playsByFormatBreakdown} />
          </section>

          {bestHourByFormat && (
            <section>
              <h2 className="mb-3 text-base font-bold text-white">Mejores horas para publicar</h2>
              <BestTimeToPostCard bestHourByFormat={bestHourByFormat} />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-base font-bold text-white">Evolución de seguidores</h2>
            <FollowerGrowthChart history={insights.followerHistory} />
          </section>

          <section>
            <h2 className="mb-3 text-base font-bold text-white">Top 5 publicaciones (30 días)</h2>
            <TopPostsList posts={insights.topPosts} />
          </section>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-white/8 bg-white/5 text-sm text-white/30">
          Conecta una cuenta de Instagram para empezar a ver tus Insights.
        </div>
      )}
    </div>
  );
}
