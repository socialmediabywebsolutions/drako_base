import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceReadinessWithBillingAndLinkedIn } from "../../src/components/saas/socialflow/SocialFlowDashboard";
import { resolveSocialContext, SocialContextError } from "../../src/lib/social/repository";
import { findSocialFlowWorkspace } from "../../src/lib/socialflow-workspace";
import * as cf from "../../src/lib/cf";
import type { DracoEnv } from "../../src/lib/cf";

const envSpy = vi.spyOn(cf, "env");

afterEach(() => {
  envSpy.mockReset();
});

const baseSummary = {
  presentation: { demoStage: "GUIDED_SETUP", stageLabel: "Guided setup", confidenceNote: "" },
  readiness: {
    stage: "PILOT_READY" as const,
    label: "Pilot-ready",
    readyNow: ["Base ready"],
    simulatedAreas: [],
    pilotNotes: [],
  },
  onboarding: { completedSteps: 5, totalSteps: 5, progressPercent: 100, nextAction: "", steps: [] },
  overview: { connectedAccounts: 1, activeCampaigns: 1, scheduledPostsThisWeek: 1, publishedPostsLast30Days: 1, engagementLast30Days: 1 },
  highlights: { draftPosts: 0, upcomingPosts: 0, archivedCampaigns: 0 },
  analytics: { last7Days: { publishedPosts: 1, engagement: 1, topProviders: [] }, last30Days: { publishedPosts: 1, engagement: 1, topProviders: [] } },
  analyticsHealth: { recentActivity: [], recentIncidents: [], lastSyncStatus: "ok", incidents: 0, refreshQueue: 0, livePosts: 0, livePostsWithErrors: 0 },
  activeRules: [],
  operations: {
    status: "ON_TRACK" as const,
    headline: "",
    criticalActions: [],
    nextMilestones: [],
    counts: {
      dueNowPosts: 0,
      scheduledNext24Hours: 0,
      draftPosts: 0,
      publishedLast7Days: 1,
      scheduledLivePosts: 0,
      dueLivePosts: 0,
      failedLivePosts: 0,
      liveAnalyticsPosts: 0,
      liveAnalyticsRefreshErrors: 0,
    },
  },
  transparency: [],
};

describe("SocialFlow readiness gating", () => {
  it("downgrades to guided setup when billing is missing", () => {
    const enforced = enforceReadinessWithBillingAndLinkedIn(baseSummary, {
      billingStatus: "",
      stripeConfigured: false,
      linkedinLiveConnected: true,
    });
    expect(enforced.readiness.stage).toBe("GUIDED_SETUP");
    expect(enforced.readiness.readyNow).toContain("Billing inactive or missing");
  });

  it("downgrades to guided setup when LinkedIn is not connected", () => {
    const enforced = enforceReadinessWithBillingAndLinkedIn(baseSummary, {
      billingStatus: "active",
      stripeConfigured: true,
      linkedinLiveConnected: false,
    });
    expect(enforced.readiness.stage).toBe("GUIDED_SETUP");
    expect(enforced.readiness.readyNow).toContain("LinkedIn live connection required");
  });

  it("keeps pilot-ready when billing and LinkedIn are satisfied", () => {
    const enforced = enforceReadinessWithBillingAndLinkedIn(baseSummary, {
      billingStatus: "active",
      stripeConfigured: true,
      linkedinLiveConnected: true,
    });
    expect(enforced.readiness.stage).toBe("PILOT_READY");
  });
});

describe("SocialFlow context resolution", () => {
  it("throws when no DB and demo not allowed", async () => {
    envSpy.mockReturnValue(null);
    await expect(
      resolveSocialContext({ tenantId: "tenant-real", saasId: "saas-1", env: null }),
    ).rejects.toBeInstanceOf(SocialContextError);
  });
});

describe("SocialFlow workspace lookup", () => {
  function mockEnvWithDb(row: any) {
    const fakeDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => row),
        })),
      })),
    } as unknown as DracoEnv["DRACO_DB"];

    envSpy.mockReturnValue({ DRACO_DB: fakeDb } as DracoEnv);
  }

  it("returns null when no SocialFlow workspace exists", async () => {
    mockEnvWithDb(null);
    const result = await findSocialFlowWorkspace("tenant_missing");
    expect(result).toBeNull();
  });

  it("maps an active SocialFlow workspace from DB row", async () => {
    mockEnvWithDb({
      id: "saas_1",
      tenant_id: "tenant_1",
      slug: "socialflow",
      name: "SocialFlow",
      custom_domain: "app.socialflow.example.com",
      public_domain: "socialflow.drako.systems",
      trial_domain: "socialflow.drako.systems",
      status: "active",
    });

    const result = await findSocialFlowWorkspace("tenant_1");

    expect(result).toEqual({
      custom_domain: "app.socialflow.example.com",
      id: "saas_1",
      tenant_id: "tenant_1",
      name: "SocialFlow",
      slug: "socialflow",
      trial_domain: "socialflow.drako.systems",
      trial_ends_at: null,
    });
  });
});
