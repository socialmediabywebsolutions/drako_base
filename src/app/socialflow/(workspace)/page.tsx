import { redirect } from "next/navigation";
import { getCurrentSocialFlowSession } from "@/lib/socialflow/auth/server";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { getLatestAudit } from "@/lib/socialflow/audit/repository";
import { resolveSocialContext, getSocialProductSummary, SocialContextError } from "@/lib/socialflow/repository";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";
import { getSocialFlowPlanDefinition, resolveSocialFlowPlanCode } from "@/lib/socialflow/billing/plans";
import DashboardMetrics from "./_components/DashboardMetrics";
import IntelligenceFeedPanel from "./_components/IntelligenceFeedPanel";
import SocialFlowOperationsPanel from "./_components/SocialFlowOperationsPanel";

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
  try {
    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId: DEFAULT_SAAS_ID });
    summary = await getSocialProductSummary(ctx);
  } catch (error) {
    if (!(error instanceof SocialContextError)) {
      console.error("SOCIALFLOW_DASHBOARD_SUMMARY_ERROR", error);
    }
  }

  const audit = await getLatestAudit(session.tenantId, DEFAULT_SAAS_ID);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-600">SocialFlow</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {snapshot.profile.brandName ? `Hola, ${snapshot.profile.brandName}` : "Tu workspace de SocialFlow"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Tu sistema operativo social: inteligencia accionable, auditorias continuas y gestion de contenido en un solo lugar.
          </p>
        </div>
        <span className="rounded-full border-2 border-sky-200 bg-sky-50 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
          Plan {planDefinition.label}
        </span>
      </div>

      {summary && <DashboardMetrics planCode={planCode} summary={summary} auditScore={audit?.score ?? null} />}

      <IntelligenceFeedPanel />

      <SocialFlowOperationsPanel />
    </div>
  );
}
