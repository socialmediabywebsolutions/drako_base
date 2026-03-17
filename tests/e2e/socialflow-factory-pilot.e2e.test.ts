import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { env as resolveEnv } from "@/lib/cf";
import { buildSocialFlowBlueprintDraft, SOCIALFLOW_DEFAULT_CUSTOM_DOMAIN, SOCIALFLOW_MVP_FEATURES, SOCIALFLOW_NAME, SOCIALFLOW_SLUG } from "@/lib/factory-products/socialflow";
import { factoryCreateSaasMocks, setupFactoryCreateSaasOwnerMocks } from "./factory-create-saas.test-kit";
import {
  buildCreateSaasRequest,
  createFactoryRuntimeEnv,
  createCloudflareFetch,
  createProvisioningHarnessStore,
  findCustomDomainRow,
  findPrimaryDomainRow,
  installProvisioningDbMock,
  processQueuedFactoryJob,
} from "./factory-create-saas.helpers";

import { POST as createSaas } from "@/app/api/owner/saas-factory/create-saas/route";
import { GET as getFeatures } from "@/app/api/features/route";
import { DELETE as disconnectSocialAccount, GET as getSocialAccounts, PATCH as patchSocialAccount, POST as upsertSocialAccount } from "@/app/api/social/accounts/route";
import { GET as getCampaigns, PATCH as patchCampaign, POST as upsertCampaign } from "@/app/api/social/campaigns/route";
import { GET as getPosts, POST as upsertPost } from "@/app/api/social/posts/route";
import { GET as getAnalytics } from "@/app/api/social/analytics/route";
import { GET as getCalendar } from "@/app/api/social/calendar/route";
import { GET as getOverview } from "@/app/api/social/overview/route";
import { GET as getMetrics } from "@/app/api/social/metrics/route";
import { GET as getSummary } from "@/app/api/social/summary/route";
import { GET as getTasks, POST as createTask } from "@/app/api/tasks/route";
import { GET as getJobStatus } from "@/app/api/owner/saas-factory/jobs/[jobId]/route";

type CreateSaasPayload = {
  ok: boolean;
  jobId: string;
  saasId: string;
};

describe("SocialFlow factory pilot", () => {
  beforeEach(() => {
    setupFactoryCreateSaasOwnerMocks();
  });

  it("creates SocialFlow through the canonical factory flow and serves the MVP endpoints", async () => {
    const store = createProvisioningHarnessStore();
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });
    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);
    factoryCreateSaasMocks.domainFetchImpl.mockImplementation(
      createCloudflareFetch({
        verifyStatuses: ["active"],
        createStatus: "pending",
        hostnameStatuses: {
          [`${SOCIALFLOW_SLUG}.drako.systems`]: ["active"],
          [SOCIALFLOW_DEFAULT_CUSTOM_DOMAIN]: ["active"],
        },
      }),
    );

    const createResponse = await createSaas(
      buildCreateSaasRequest({
        slug: SOCIALFLOW_SLUG,
        name: SOCIALFLOW_NAME,
        customDomainRequested: SOCIALFLOW_DEFAULT_CUSTOM_DOMAIN,
        blueprintDraft: buildSocialFlowBlueprintDraft({ customDomainRequested: SOCIALFLOW_DEFAULT_CUSTOM_DOMAIN }) as Record<string, unknown>,
      }) as any,
    );
    expect(createResponse.status).toBe(202);

    const createPayload = await createResponse.json() as CreateSaasPayload;
    await processQueuedFactoryJob(store, runtimeEnv, createPayload.jobId);

    const jobResponse = await getJobStatus(
      new Request(`https://drako.systems/api/owner/saas-factory/jobs/${createPayload.jobId}`) as any,
      { params: Promise.resolve({ jobId: createPayload.jobId }) },
    );
    expect(jobResponse.status).toBe(200);
    const jobPayload = await jobResponse.json() as {
      job: {
        saasId: string;
        state: string;
        timeline: Array<{ state: string }>;
      };
    };

    const saasId = jobPayload.job.saasId;
    expect(jobPayload.job.state).toBe("SUCCESS");
    expect(jobPayload.job.timeline.some((entry) => entry.state === "CUSTOM_DOMAIN_READY")).toBe(true);

    const primaryDomainRow = findPrimaryDomainRow(store, saasId);
    const customDomainRow = findCustomDomainRow(store, saasId, SOCIALFLOW_DEFAULT_CUSTOM_DOMAIN);
    expect(primaryDomainRow?.domain).toBe(`${SOCIALFLOW_SLUG}.drako.systems`);
    expect(primaryDomainRow?.status).toBe("active");
    expect(customDomainRow?.status).toBe("active");

    const provisioningRow = store.campamentoProvisioning.find((row) => row.saas_id === saasId);
    const provisioningPlan = provisioningRow?.plan ? JSON.parse(provisioningRow.plan) as {
      runtime?: { status?: string; activationReady?: boolean; runtimeName?: string };
      bootstrap?: { status?: string; readinessMarker?: string };
      customDomainDeployment?: { status?: string; verificationReady?: boolean };
    } : null;
    expect(provisioningRow?.status).toBe("active");
    expect(provisioningPlan?.runtime).toMatchObject({
      status: "active",
      activationReady: true,
      runtimeName: "shared_open_next_runtime",
    });
    expect(provisioningPlan?.bootstrap).toMatchObject({
      status: "ready",
      readinessMarker: "bootstrap_ready",
    });
    expect(provisioningPlan?.customDomainDeployment).toMatchObject({
      status: "active",
      verificationReady: true,
    });

    const enabledFeatureKeys = store.saasFeatures
      .filter((row) => row.saas_id === saasId && row.status === "ENABLED")
      .map((row) => row.feature_key);
    for (const featureKey of SOCIALFLOW_MVP_FEATURES) {
      expect(enabledFeatureKeys).toContain(featureKey);
    }

    const featuresResponse = await getFeatures(
      new Request(`https://drako.systems/api/features?saasId=${saasId}`) as any,
    );
    expect(featuresResponse.status).toBe(200);
    const featuresPayload = await featuresResponse.json() as {
      count: number;
      items: Array<{ featureKey: string; status: string }>;
    };
    expect(featuresPayload.count).toBeGreaterThan(0);
    expect(featuresPayload.items.some((item) => item.featureKey === "SOCIAL" && item.status === "ENABLED")).toBe(true);

    const initialSummaryResponse = await getSummary(
      new Request(`https://drako.systems/api/social/summary?saasId=${saasId}`) as any,
    );
    expect(initialSummaryResponse.status).toBe(200);
    const initialSummaryPayload = await initialSummaryResponse.json() as {
      accounts_connected: number;
      campaigns_active: number;
      posts_scheduled: number;
      posts_published_30d: number;
      engagement_30d: number;
      summary: {
        presentation: { demoStage: string; stageLabel: string; confidenceNote: string };
        readiness: { stage: string; label: string; pilotNotes: string[] };
        onboarding: { completedSteps: number; nextAction: string };
        overview: { connectedAccounts: number; activeCampaigns: number; scheduledPostsThisWeek: number; publishedPostsLast30Days: number };
        operations: {
          status: string;
          criticalActions: string[];
          counts: { dueNowPosts: number; scheduledNext24Hours: number; draftPosts: number; publishedLast7Days: number };
        };
        transparency: Array<{ key: string; label: string; message: string }>;
      };
    };
    expect(initialSummaryPayload.summary.presentation).toMatchObject({
      demoStage: "GUIDED_SETUP",
      stageLabel: "Guided setup walkthrough",
    });
    expect(initialSummaryPayload.summary.presentation.confidenceNote).toContain("setup checklist");
    expect(initialSummaryPayload.summary.readiness.stage).toBe("GUIDED_SETUP");
    expect(initialSummaryPayload.summary.readiness.label).toBe("Guided setup");
    expect(initialSummaryPayload.summary.operations.status).toBe("NEEDS_SETUP");
    expect(initialSummaryPayload.summary.operations.criticalActions.length).toBeGreaterThan(0);
    expect(initialSummaryPayload.summary.onboarding.completedSteps).toBe(0);
    expect(initialSummaryPayload.summary.onboarding.nextAction).toBe("Connect a social account");
    expect(initialSummaryPayload.summary.overview).toMatchObject({
      connectedAccounts: 0,
      activeCampaigns: 0,
      scheduledPostsThisWeek: 0,
      publishedPostsLast30Days: 0,
    });
    expect(initialSummaryPayload.accounts_connected).toBe(0);
    expect(initialSummaryPayload.campaigns_active).toBe(0);
    expect(initialSummaryPayload.posts_scheduled).toBe(0);
    expect(initialSummaryPayload.posts_published_30d).toBe(0);
    expect(initialSummaryPayload.engagement_30d).toBe(0);
    expect(initialSummaryPayload.summary.transparency).toEqual([
      expect.objectContaining({ key: "connections", label: "Demo account connections" }),
      expect.objectContaining({ key: "analytics", label: "Placeholder analytics" }),
      expect.objectContaining({ key: "publishing", label: "Simulated publishing loop" }),
    ]);

    const primaryAccountResponse = await upsertSocialAccount(
      new Request("https://drako.systems/api/social/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          provider: "INSTAGRAM",
          handle: "@socialflowhq",
          displayName: "SocialFlow HQ",
          status: "CONNECTED_DEMO",
          authMeta: { mode: "placeholder" },
          isPrimary: true,
        }),
      }) as any,
    );
    expect(primaryAccountResponse.status).toBe(200);
    const primaryAccountPayload = await primaryAccountResponse.json() as { account: { id: string } };

    const secondaryAccountResponse = await upsertSocialAccount(
      new Request("https://drako.systems/api/social/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          provider: "TWITTER_X",
          handle: "@socialflowupdates",
          displayName: "SocialFlow Updates",
          status: "CONNECTED_DEMO",
          authMeta: { mode: "placeholder" },
          isPrimary: false,
        }),
      }) as any,
    );
    expect(secondaryAccountResponse.status).toBe(200);
    const secondaryAccountPayload = await secondaryAccountResponse.json() as { account: { id: string } };

    const makePrimaryResponse = await patchSocialAccount(
      new Request("https://drako.systems/api/social/accounts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: secondaryAccountPayload.account.id,
          saasId,
          isPrimary: true,
        }),
      }) as any,
    );
    expect(makePrimaryResponse.status).toBe(200);

    const disconnectResponse = await disconnectSocialAccount(
      new Request("https://drako.systems/api/social/accounts", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: primaryAccountPayload.account.id,
          saasId,
        }),
      }) as any,
    );
    expect(disconnectResponse.status).toBe(200);

    const accountListResponse = await getSocialAccounts(
      new Request(`https://drako.systems/api/social/accounts?saasId=${saasId}`) as any,
    );
    expect(accountListResponse.status).toBe(200);
    const accountListPayload = await accountListResponse.json() as {
      count: number;
      items: Array<{ provider: string; status: string; handle: string | null; isPrimary: boolean }>;
    };
    expect(accountListPayload.count).toBe(2);
    expect(accountListPayload.items.some((item) => item.provider === "INSTAGRAM" && item.status === "DISCONNECTED")).toBe(true);
    expect(accountListPayload.items.some((item) => item.provider === "TWITTER_X" && item.isPrimary)).toBe(true);

    const campaignResponse = await upsertCampaign(
      new Request("https://drako.systems/api/social/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          name: "Pilot Launch Queue",
          objective: "Validate scheduling workflow",
          status: "ACTIVE",
          targetSegment: "early operators",
          budgetEstimate: 150,
        }),
      }) as any,
    );
    expect(campaignResponse.status).toBe(200);
    const campaignPayload = await campaignResponse.json() as { campaign: { id: string } };

    const updateCampaignResponse = await patchCampaign(
      new Request("https://drako.systems/api/social/campaigns", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: campaignPayload.campaign.id,
          saasId,
          objective: "Validate scheduling and automation workflow",
          budgetEstimate: 240,
        }),
      }) as any,
    );
    expect(updateCampaignResponse.status).toBe(200);

    const archivedCampaignResponse = await upsertCampaign(
      new Request("https://drako.systems/api/social/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          name: "Archived Retrospective",
          objective: "Close out launch assets",
          status: "ARCHIVED",
          targetSegment: "internal team",
        }),
      }) as any,
    );
    expect(archivedCampaignResponse.status).toBe(200);

    const scheduledPostResponse = await upsertPost(
      new Request("https://drako.systems/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          campaignId: campaignPayload.campaign.id,
          provider: "INSTAGRAM",
          contentType: "REEL",
          title: "Launch reel",
          body: "SocialFlow pilot is live on the canonical factory pipeline.",
          status: "SCHEDULED",
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          metadata: { placeholder: true },
        }),
      }) as any,
    );
    expect(scheduledPostResponse.status).toBe(200);

    const preAutomationSummaryResponse = await getSummary(
      new Request(`https://drako.systems/api/social/summary?saasId=${saasId}`) as any,
    );
    expect(preAutomationSummaryResponse.status).toBe(200);
    const preAutomationSummaryPayload = await preAutomationSummaryResponse.json() as {
      summary: {
        onboarding: { completedSteps: number; nextAction: string };
        overview: { connectedAccounts: number; activeCampaigns: number; scheduledPostsThisWeek: number };
      };
    };
    expect(preAutomationSummaryPayload.summary.onboarding.completedSteps).toBe(4);
    expect(preAutomationSummaryPayload.summary.onboarding.nextAction).toBe("Turn on auto-publish");
    expect(preAutomationSummaryPayload.summary.overview).toMatchObject({
      connectedAccounts: 1,
      activeCampaigns: 1,
      scheduledPostsThisWeek: 1,
    });

    const automationResponse = await createTask(
      new Request("https://drako.systems/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          title: "Auto-publish when scheduled",
          description: "Publish scheduled SocialFlow content automatically when due.",
          category: "SOCIAL",
          severity: "SUGGESTION",
          metadata: {
            type: "automation_rule",
            trigger: "post.scheduled",
            action: "publish.placeholder",
            scope: {
              providers: ["INSTAGRAM", "TWITTER_X"],
            },
          },
        }),
      }) as any,
    );
    expect(automationResponse.status).toBe(200);

    const autoPublishPostResponse = await upsertPost(
      new Request("https://drako.systems/api/social/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          saasId,
          campaignId: campaignPayload.campaign.id,
          provider: "TWITTER_X",
          contentType: "FEED",
          title: "Automation post",
          body: "This scheduled post should auto-publish through the SocialFlow MVP rule engine.",
          status: "SCHEDULED",
          scheduledAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          metadata: { automation: true },
        }),
      }) as any,
    );
    expect(autoPublishPostResponse.status).toBe(200);
    const autoPublishPostPayload = await autoPublishPostResponse.json() as { post: { id: string } };

    const campaignsResponse = await getCampaigns(
      new Request(`https://drako.systems/api/social/campaigns?saasId=${saasId}`) as any,
    );
    expect(campaignsResponse.status).toBe(200);
    const campaignsPayload = await campaignsResponse.json() as {
      count: number;
      items: Array<{ name: string; status: string; objective: string; budgetEstimate: number | null }>;
    };
    expect(campaignsPayload.count).toBe(2);
    expect(campaignsPayload.items.some((item) => item.name === "Pilot Launch Queue" && item.budgetEstimate === 240)).toBe(true);
    expect(campaignsPayload.items.some((item) => item.status === "ARCHIVED")).toBe(true);

    const calendarResponse = await getCalendar(
      new Request(`https://drako.systems/api/social/calendar?saasId=${saasId}`) as any,
    );
    expect(calendarResponse.status).toBe(200);
    const calendarPayload = await calendarResponse.json() as {
      calendar: {
        days: Array<{ date: string; posts: Array<{ title: string; status: string }> }>;
        upcomingPosts: Array<{ title: string; status: string }>;
      };
    };
    expect(calendarPayload.calendar.days.length).toBeGreaterThan(0);
    expect(calendarPayload.calendar.upcomingPosts).toHaveLength(1);
    expect(calendarPayload.calendar.upcomingPosts[0]).toMatchObject({
      title: "Launch reel",
      status: "SCHEDULED",
    });

    const postsResponse = await getPosts(
      new Request(`https://drako.systems/api/social/posts?saasId=${saasId}&status=SCHEDULED`) as any,
    );
    expect(postsResponse.status).toBe(200);
    const postsPayload = await postsResponse.json() as { count: number };
    expect(postsPayload.count).toBe(1);

    const publishedPostsResponse = await getPosts(
      new Request(`https://drako.systems/api/social/posts?saasId=${saasId}&status=PUBLISHED`) as any,
    );
    expect(publishedPostsResponse.status).toBe(200);
    const publishedPostsPayload = await publishedPostsResponse.json() as {
      count: number;
      items: Array<{ id: string; title: string; status: string }>;
    };
    expect(publishedPostsPayload.count).toBe(1);
    expect(publishedPostsPayload.items[0]).toMatchObject({
      id: autoPublishPostPayload.post.id,
      title: "Automation post",
      status: "PUBLISHED",
    });

    const metricsResponse = await getMetrics(
      new Request(`https://drako.systems/api/social/metrics?saasId=${saasId}&postId=${autoPublishPostPayload.post.id}`) as any,
    );
    expect(metricsResponse.status).toBe(200);
    const metricsPayload = await metricsResponse.json() as {
      items: Array<{ impressions: number; likes: number; comments: number; shares: number; clicks: number }>;
    };
    expect(metricsPayload.items).toHaveLength(1);
    expect(metricsPayload.items[0].impressions).toBeGreaterThan(0);

    const analyticsResponse = await getAnalytics(
      new Request(`https://drako.systems/api/social/analytics?saasId=${saasId}`) as any,
    );
    expect(analyticsResponse.status).toBe(200);
    const analyticsPayload = await analyticsResponse.json() as {
      analytics: {
        last7Days: { impressions: number; engagement: number; publishedPosts: number };
        last30Days: { impressions: number; engagement: number; publishedPosts: number };
      };
    };
    expect(analyticsPayload.analytics.last7Days.publishedPosts).toBe(1);
    expect(analyticsPayload.analytics.last7Days.impressions).toBeGreaterThan(0);
    expect(analyticsPayload.analytics.last30Days.engagement).toBeGreaterThan(0);
    expect(analyticsPayload.analytics.last30Days.topProvider).toBe("TWITTER_X");
    expect(analyticsPayload.analytics.last30Days.averageEngagementPerPublishedPost).toBeGreaterThan(0);

    const overviewResponse = await getOverview(
      new Request(`https://drako.systems/api/social/overview?saasId=${saasId}`) as any,
    );
    expect(overviewResponse.status).toBe(200);
    const overviewPayload = await overviewResponse.json() as {
      overview: {
        connectedAccounts: number;
        activeCampaigns: number;
        scheduledThisWeek: number;
        engagementLast30Days: number;
      };
    };
    expect(overviewPayload.overview).toMatchObject({
      connectedAccounts: 1,
      activeCampaigns: 1,
      scheduledThisWeek: 1,
    });
    expect(overviewPayload.overview.engagementLast30Days).toBeGreaterThan(0);

    const tasksResponse = await getTasks(
      new Request(`https://drako.systems/api/tasks?saasId=${saasId}&category=SOCIAL`) as any,
    );
    expect(tasksResponse.status).toBe(200);
    const tasksPayload = await tasksResponse.json() as {
      count: number;
      items: Array<{ title: string; category: string; metadata: Record<string, unknown> | null }>;
    };
    expect(tasksPayload.count).toBe(1);
    expect(tasksPayload.items[0]).toMatchObject({
      category: "SOCIAL",
      title: "Auto-publish when scheduled",
    });
    expect(tasksPayload.items[0].metadata?.type).toBe("automation_rule");
    expect(tasksPayload.items[0].metadata?.trigger).toBe("post.scheduled");
    expect(tasksPayload.items[0].metadata?.action).toBe("publish.placeholder");
    expect((tasksPayload.items[0].metadata?.scope as { providers?: string[] } | undefined)?.providers).toContain("INSTAGRAM");

    const finalSummaryResponse = await getSummary(
      new Request(`https://drako.systems/api/social/summary?saasId=${saasId}`) as any,
    );
    expect(finalSummaryResponse.status).toBe(200);
    const finalSummaryPayload = await finalSummaryResponse.json() as {
      accounts_connected: number;
      campaigns_active: number;
      posts_scheduled: number;
      posts_published_30d: number;
      engagement_30d: number;
      summary: {
        presentation: { demoStage: string; stageLabel: string; confidenceNote: string };
        readiness: { stage: string; label: string; readyNow: string[]; simulatedAreas: string[]; pilotNotes: string[] };
        onboarding: {
          completedSteps: number;
          totalSteps: number;
          progressPercent: number;
          nextAction: string;
          steps: Array<{ key: string; completed: boolean }>;
        };
        overview: {
          connectedAccounts: number;
          activeCampaigns: number;
          scheduledPostsThisWeek: number;
          publishedPostsLast30Days: number;
          engagementLast30Days: number;
        };
        operations: {
          status: string;
          headline: string;
          criticalActions: string[];
          nextMilestones: string[];
          counts: {
            dueNowPosts: number;
            scheduledNext24Hours: number;
            draftPosts: number;
            publishedLast7Days: number;
          };
        };
        highlights: {
          draftPosts: number;
          upcomingPosts: number;
          archivedCampaigns: number;
        };
        activeRules: Array<{ title: string; trigger: string; action: string; scope: Record<string, unknown> | null }>;
        analytics: {
          last30Days: { topProvider: string | null; averageEngagementPerPublishedPost: number };
        };
        transparency: Array<{ key: string; label: string; message: string }>;
      };
    };
    expect(finalSummaryPayload.summary.presentation).toMatchObject({
      demoStage: "LIVE_DEMO_READY",
      stageLabel: "Live walkthrough ready",
    });
    expect(finalSummaryPayload.summary.presentation.confidenceNote).toContain("full account, campaign, calendar, publishing, and analytics loop");
    expect(finalSummaryPayload.summary.readiness.stage).toBe("PILOT_READY");
    expect(finalSummaryPayload.summary.readiness.label).toBe("Pilot-ready");
    expect(finalSummaryPayload.summary.readiness.readyNow.length).toBeGreaterThan(0);
    expect(finalSummaryPayload.summary.readiness.simulatedAreas.length).toBe(3);
    expect(finalSummaryPayload.summary.operations.status).toBe("ON_TRACK");
    expect(finalSummaryPayload.summary.operations.criticalActions).toHaveLength(0);
    expect(finalSummaryPayload.summary.operations.counts.publishedLast7Days).toBeGreaterThan(0);
    expect(finalSummaryPayload.summary.onboarding.completedSteps).toBe(5);
    expect(finalSummaryPayload.summary.onboarding.totalSteps).toBe(5);
    expect(finalSummaryPayload.summary.onboarding.progressPercent).toBe(100);
    expect(finalSummaryPayload.summary.onboarding.nextAction).toBe("Onboarding complete");
    expect(finalSummaryPayload.summary.onboarding.steps.every((step) => step.completed)).toBe(true);
    expect(finalSummaryPayload.summary.overview).toMatchObject({
      connectedAccounts: 1,
      activeCampaigns: 1,
      scheduledPostsThisWeek: 1,
      publishedPostsLast30Days: 1,
    });
    expect(finalSummaryPayload.accounts_connected).toBe(1);
    expect(finalSummaryPayload.campaigns_active).toBe(1);
    expect(finalSummaryPayload.posts_scheduled).toBe(1);
    expect(finalSummaryPayload.posts_published_30d).toBe(1);
    expect(finalSummaryPayload.summary.overview.engagementLast30Days).toBeGreaterThan(0);
    expect(finalSummaryPayload.engagement_30d).toBeGreaterThan(0);
    expect(finalSummaryPayload.summary.highlights).toMatchObject({
      draftPosts: 0,
      upcomingPosts: 1,
      archivedCampaigns: 1,
    });
    expect(finalSummaryPayload.summary.activeRules).toEqual([
      expect.objectContaining({
        title: "Auto-publish when scheduled",
        trigger: "post.scheduled",
        action: "publish.placeholder",
      }),
    ]);
    expect((finalSummaryPayload.summary.activeRules[0].scope?.providers as string[])).toContain("TWITTER_X");
    expect(finalSummaryPayload.summary.analytics.last30Days.topProvider).toBe("TWITTER_X");
    expect(finalSummaryPayload.summary.transparency).toHaveLength(3);
    expect(finalSummaryPayload.summary.transparency[1].message).toContain("placeholder engagement signals");
    expect(finalSummaryPayload.summary.analytics.last30Days.averageEngagementPerPublishedPost).toBeGreaterThan(0);
  });
});
