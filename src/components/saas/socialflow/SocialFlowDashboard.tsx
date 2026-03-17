import SocialFlowWorkspaceClient from "@/components/saas/socialflow/SocialFlowWorkspaceClient";
import { hasLivePostAnalytics } from "@/lib/social/analytics-window";
import {
  getSocialAnalyticsSnapshot,
  getSocialCalendarSnapshot,
  getSocialProductSummary,
  listSaasSocialAccounts,
  listSaasSocialCampaigns,
  listSaasSocialChannels,
  listSaasSocialPosts,
  resolveSocialContext,
} from "@/lib/social/repository";
import { listTasks, resolveTasksContext } from "@/lib/tasks/repository";
import type { SaasSocialAccount, SaasSocialPost } from "@/lib/social/types";

type SocialFlowDashboardProps = {
  tenantId: string;
  saasId: string;
  instance: {
    id: string;
    slug: string;
    name: string;
    custom_domain?: string | null;
    trial_domain?: string | null;
  };
  workspaceBilling: {
    plan: string;
    status: string;
    currentPeriodEnd: string | null;
    stripeConfigured: boolean;
  };
};

export function enforceReadinessWithBillingAndLinkedIn(
  summary: Awaited<ReturnType<typeof getSocialProductSummary>>,
  opts: { billingStatus: string; stripeConfigured: boolean; linkedinLiveConnected: boolean },
) {
  const billingStatus = opts.billingStatus?.toLowerCase?.() ?? "";
  const billingActive = opts.stripeConfigured || billingStatus === "active" || billingStatus === "trialing";
  const linkedinReady = opts.linkedinLiveConnected;

  if (billingActive && linkedinReady) return summary;

  const gating: string[] = [];
  if (!billingActive) gating.push("Billing inactive or missing");
  if (!linkedinReady) gating.push("LinkedIn live connection required");

  return {
    ...summary,
    readiness: {
      stage: "GUIDED_SETUP" as const,
      label: "Guided setup",
      readyNow: gating,
      simulatedAreas: summary.readiness.simulatedAreas,
      pilotNotes: summary.readiness.pilotNotes,
    },
  };
}

export default async function SocialFlowDashboard({ tenantId, saasId, instance, workspaceBilling }: SocialFlowDashboardProps) {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  const tasksCtx = await resolveTasksContext({ tenantId, saasId }).catch(() => null);

  const summary = await getSocialProductSummary(ctx);
  const [accounts, campaigns, channels, posts, calendar, analytics, tasks] = await Promise.all([
    listSaasSocialAccounts(ctx),
    listSaasSocialCampaigns(ctx),
    listSaasSocialChannels(ctx),
    listSaasSocialPosts(ctx),
    getSocialCalendarSnapshot(ctx),
    getSocialAnalyticsSnapshot(ctx),
    tasksCtx ? listTasks(tasksCtx, { category: "SOCIAL" }).catch(() => []) : Promise.resolve([]),
  ]);

  const liveConnectedAccounts = accounts.filter((account: SaasSocialAccount) => account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL").length;
  const livePublishedPosts = posts.filter(isLivePublishedPost).length;
  const liveAnalyticsPosts = posts.filter(hasLivePostAnalytics).length;
  const billingReady = workspaceBilling.stripeConfigured || ["active", "trialing"].includes(workspaceBilling.status.toLowerCase());
  const enforcedSummary = enforceReadinessWithBillingAndLinkedIn(summary, {
    billingStatus: workspaceBilling.status,
    stripeConfigured: workspaceBilling.stripeConfigured,
    linkedinLiveConnected: liveConnectedAccounts > 0,
  });
  const effectiveSummary = enforcedSummary.readiness.stage === "PILOT_READY" && billingReady && liveConnectedAccounts > 0 && livePublishedPosts > 0
    ? {
        ...enforcedSummary,
        readiness: {
          ...enforcedSummary.readiness,
          stage: "FIRST_PAYING_USER_READY" as const,
          label: "First-paying-user-ready",
          readyNow: [
            ...enforcedSummary.readiness.readyNow,
            "At least one LinkedIn post has already been published live from this workspace.",
            ...(liveAnalyticsPosts > 0 ? ["Real LinkedIn engagement metrics are already visible for at least one live post."] : []),
          ],
          pilotNotes: [
            "This workspace can now demonstrate one real published output plus a canonical path to paid billing.",
            liveAnalyticsPosts > 0
              ? "SocialFlow is ready for a first paying user, with live publishing and live LinkedIn engagement metrics on the same workspace loop."
              : "SocialFlow is ready for a first paying user, even while broader channel coverage and analytics stay in MVP mode.",
          ],
        },
      }
    : enforcedSummary;

  return (
    <SocialFlowWorkspaceClient
      tenantId={tenantId}
      saasId={saasId}
      instance={instance}
      workspaceBilling={workspaceBilling}
      initialData={{
        summary: effectiveSummary,
        accounts,
        campaigns,
        channels,
        posts,
        calendar,
        analytics,
        tasks,
      }}
    />
  );
}

function isLivePublishedPost(post: SaasSocialPost) {
  if (post.status !== "PUBLISHED" && post.status !== "POSTED") return false;
  if (!post.metadata?.publication || typeof post.metadata.publication !== "object") return false;
  return (post.metadata.publication as Record<string, unknown>).mode === "live";
}
