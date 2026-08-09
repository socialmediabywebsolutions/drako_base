// Data routes: /api/socialflow/campaigns /api/socialflow/posts
import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getLatestAudit } from "@/lib/socialflow/audit/repository";
import { resolveSocialContext, getSocialProductSummary, getSocialActivitySummary, SocialContextError } from "@/lib/socialflow/repository";
import { countLeadsSince } from "@/lib/socialflow/leads/repository";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getSocialFlowPlanDefinition, resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import DashboardMetrics from "./_components/DashboardMetrics";
import DashboardActivityCards from "./_components/DashboardActivityCards";
import IntelligenceFeedPanel from "./_components/IntelligenceFeedPanel";
import SocialFlowOperationsPanel from "./_components/SocialFlowOperationsPanel";
import { getEmpresaChecklist } from "@/lib/socialflow/onboarding/checklistRepository";
import EmpresaChecklist from "@/components/socialflow/EmpresaChecklist";

const DEFAULT_SAAS_ID = "socialflow";

export default async function SocialFlowDashboardPage() {
  const session = await getCurrentSocialFlowSession();
  if (!session) {
    redirect("/socialflow/auth");
  }

  const snapshot = await getChannelKnowledge(session.tenantId, DEFAULT_SAAS_ID);
  if (!snapshot.profile.onboardingCompletedAt) {
    redirect("/socialflow/onboarding");
  }

  const billingSnapshot = await getCanonicalBillingSnapshot({ tenantId: session.tenantId, saasSlug: "socialflow" });
  const planCode = resolveSocialFlowPlanCode(billingSnapshot.subscription);
  const planDefinition = getSocialFlowPlanDefinition(planCode);

  let summary: Awaited<ReturnType<typeof getSocialProductSummary>> | null = null;
  let leadsCount = 0;
  let activity: Awaited<ReturnType<typeof getSocialActivitySummary>> | null = null;
  try {
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: DEFAULT_SAAS_ID });
    const thirtyDaysAgoIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    [summary, leadsCount, activity] = await Promise.all([
      getSocialProductSummary(ctx),
      countLeadsSince(ctx, thirtyDaysAgoIso),
      getSocialActivitySummary(ctx),
    ]);
  } catch (error) {
    if (!(error instanceof SocialContextError)) {
      console.error("SOCIALFLOW_DASHBOARD_SUMMARY_ERROR", error);
    }
  }

  const audit = await getLatestAudit(session.tenantId, DEFAULT_SAAS_ID);

  let empresaChecklist: Awaited<ReturnType<typeof getEmpresaChecklist>> | null = null;
  if (session.accountType === "empresa") {
    try {
      empresaChecklist = await getEmpresaChecklist(session.tenantId, DEFAULT_SAAS_ID);
    } catch (error) {
      console.error("SOCIALFLOW_DASHBOARD_CHECKLIST_ERROR", error);
    }
  }
  const showChecklistWidget = Boolean(empresaChecklist && empresaChecklist.completedCount < empresaChecklist.totalCount);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-400">Socialcors</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
            {snapshot.profile.brandName ? `Hola, ${snapshot.profile.brandName}` : "Tu workspace de Socialcors"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Tu sistema operativo de marketing: inteligencia accionable, auditorías continuas y gestión de contenido en un solo lugar.
          </p>
        </div>
        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
          Plan {planDefinition.label}
        </span>
      </div>

      {summary && <DashboardMetrics planCode={planCode} summary={summary} auditScore={audit?.score ?? null} leadsCount={leadsCount} />}

      {activity && <DashboardActivityCards activity={activity} />}

      {showChecklistWidget && empresaChecklist && (
        <EmpresaChecklist
          items={empresaChecklist.items}
          completedCount={empresaChecklist.completedCount}
          totalCount={empresaChecklist.totalCount}
        />
      )}

      <SocialFlowOperationsPanel />

      <IntelligenceFeedPanel />
    </div>
  );
}
