import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import SocialFlowWorkspaceClient from "../../../src/components/saas/socialflow/SocialFlowWorkspaceClient";
import type { SaasSocialAccount, SaasSocialCampaign, SaasSocialChannel, SaasSocialPost, SocialProductSummary } from "../../../src/lib/social/types";

const fetchMock = vi.spyOn(global, "fetch");

function getLinkedInAccountSelect(): HTMLSelectElement {
  const el = screen.getByTestId("linkedin-account-select") as HTMLSelectElement;
  if (!el) throw new Error("LinkedIn account select not found");
  return el;
}

function getStatusSelect(): HTMLSelectElement {
  const el = screen.getByTestId("status-select") as HTMLSelectElement;
  if (!el) throw new Error("Status select not found");
  return el;
}

function getPublishingPathSelect(): HTMLSelectElement {
  const el = screen.getByTestId("publishing-path-select") as HTMLSelectElement;
  if (!el) throw new Error("Publishing path select not found");
  return el;
}

function getChannelSelect(): HTMLSelectElement {
  const el = screen.getByTestId("channel-select") as HTMLSelectElement;
  if (!el) throw new Error("Channel select not found");
  return el;
}

function getKnowledgeFormField(testId: string): HTMLInputElement {
  const el = screen.getByTestId(testId) as HTMLInputElement;
  if (!el) throw new Error(`${testId} not found`);
  return el;
}

function getSignalsField(testId: string): HTMLInputElement | HTMLTextAreaElement {
  const el = screen.getByTestId(testId) as HTMLInputElement | HTMLTextAreaElement;
  if (!el) throw new Error(`${testId} not found`);
  return el;
}

function getIdeaField(testId: string): HTMLInputElement {
  const el = screen.getByTestId(testId) as HTMLInputElement;
  if (!el) throw new Error(`${testId} not found`);
  return el;
}

function getPostTitleInput(): HTMLInputElement {
  const el = screen.getByTestId("post-title") as HTMLInputElement;
  if (!el) throw new Error("post-title not found");
  return el;
}

const baseSummary: SocialProductSummary = {
  presentation: { demoStage: "LIVE_DEMO_READY", stageLabel: "", confidenceNote: "" },
  readiness: { stage: "PILOT_READY", label: "", readyNow: [], simulatedAreas: [], pilotNotes: [] },
  onboarding: { completedSteps: 5, totalSteps: 5, progressPercent: 100, nextAction: "", steps: [] },
  overview: { connectedAccounts: 2, activeCampaigns: 1, scheduledPostsThisWeek: 1, publishedPostsLast30Days: 1, engagementLast30Days: 1 },
  highlights: { draftPosts: 0, upcomingPosts: 1, archivedCampaigns: 0 },
  analytics: {
    last7Days: { impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagement: 0, leadsGenerated: 0, publishedPosts: 0, topProvider: "LINKEDIN", averageEngagementPerPublishedPost: 0 },
    last30Days: { impressions: 0, likes: 0, comments: 0, shares: 0, clicks: 0, engagement: 0, leadsGenerated: 0, publishedPosts: 0, topProvider: "LINKEDIN", averageEngagementPerPublishedPost: 0 },
  },
  analyticsHealth: {
    totalEligibleLivePosts: 0,
    healthyPosts: 0,
    failedPosts: 0,
    noLiveAnalyticsYetPosts: 0,
    lastHealthyLiveSyncAt: null,
    healthySyncFreshnessStatus: "FRESH",
    healthySyncNeedsRefresh: false,
    resolvedRecently: false,
    resolvedRecentlyCount: 0,
    lastResolvedAt: null,
    lastWorkspaceSyncAt: null,
    status: "Healthy",
    recommendation: "",
    recentActivity: [],
    recentIncidents: [],
  },
  activeRules: [],
  operations: {
    status: "ON_TRACK",
    headline: "",
    criticalActions: [],
    nextMilestones: [],
    counts: {
      dueNowPosts: 0,
      scheduledNext24Hours: 0,
      draftPosts: 0,
      publishedLast7Days: 0,
      scheduledLivePosts: 0,
      dueLivePosts: 0,
      failedLivePosts: 0,
      liveAnalyticsPosts: 0,
      liveAnalyticsRefreshErrors: 0,
    },
  },
  transparency: [],
};

const linkedInAccounts: SaasSocialAccount[] = [
  {
    id: "acct_drako",
    tenantId: "tenant_1",
    saasId: "saas_1",
    provider: "LINKEDIN",
    handle: "@drako",
    displayName: "Drako",
    status: "CONNECTED_REAL",
    authMeta: { accessToken: "token-drako", authorUrn: "urn:li:person:drako" },
    isPrimary: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "acct_socialflow",
    tenantId: "tenant_1",
    saasId: "saas_1",
    provider: "LINKEDIN",
    handle: "@socialflow",
    displayName: "SocialFlow",
    status: "CONNECTED_REAL",
    authMeta: { accessToken: "token-sf", authorUrn: "urn:li:person:sf" },
    isPrimary: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const channelKnowledge = {
  channelId: "channel_general",
  tenantId: "tenant_1",
  saasId: "saas_1",
  objective: "b2b",
  audience: "operators",
  tone: "direct",
  keywords: ["pilot", "loop"],
  competitors: ["alt1"],
  sources: ["brief"],
  updatedAt: new Date().toISOString(),
};

const channelIdeas = [
  {
    id: "idea_1",
    channelId: "channel_general",
    tenantId: "tenant_1",
    saasId: "saas_1",
    title: "Idea one",
    angle: "Hook",
    summary: "Short summary",
    status: "idea" as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const channelSignals = {
  channelId: "channel_general",
  tenantId: "tenant_1",
  saasId: "saas_1",
  topics: ["launches"],
  activeKeywords: ["pilot"],
  trendNotes: "trending note",
  watchedCompetitors: ["alt1"],
  watchedSources: ["feed"],
  updatedAt: new Date().toISOString(),
};

const channels: SaasSocialChannel[] = [
  {
    id: "channel_general",
    tenantId: "tenant_1",
    saasId: "saas_1",
    name: "General",
    description: null,
    niche: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "channel_launch",
    tenantId: "tenant_1",
    saasId: "saas_1",
    name: "Launches",
    description: null,
    niche: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const campaigns: SaasSocialCampaign[] = [
  {
    id: "camp_1",
    tenantId: "tenant_1",
    saasId: "saas_1",
    name: "Launch",
    objective: "Go live",
    status: "ACTIVE",
    targetSegment: "",
    budgetEstimate: null,
    notes: null,
    startDate: null,
    endDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const stableInitialPayload = buildProps().initialData;
const stableInitialPayloadJson = JSON.stringify(stableInitialPayload);

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("SocialFlowWorkspaceClient channel knowledge", () => {
  it("loads knowledge for default channel and fills form", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await waitFor(() => expect(getKnowledgeFormField("knowledge-objective").value).toBe("b2b"));
    expect(getKnowledgeFormField("knowledge-keywords").value).toContain("pilot");
  });

  it("saves updated knowledge", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await waitFor(() => expect(getKnowledgeFormField("knowledge-objective").value).toBe("b2b"));
    fireEvent.change(getKnowledgeFormField("knowledge-objective"), { target: { value: "saas niche" } });

    await act(async () => {
      fireEvent.submit(screen.getByTestId("knowledge-form"));
    });

    const knowledgePost = fetchMock.mock.calls.find(([req, init]) => {
      const url = typeof req === "string" ? req : req instanceof Request ? req.url : "";
      return url.includes("/knowledge") && (init?.method ?? "GET").toUpperCase() === "POST";
    });
    expect(knowledgePost).toBeTruthy();
  });
});

describe("SocialFlowWorkspaceClient channel ideas", () => {
  it("loads ideas for default channel and shows list", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await waitFor(() => expect(screen.getByTestId("idea-title-idea_1")).toBeInTheDocument());
    expect(screen.getByTestId("idea-status-idea_1")).toHaveValue("idea");
  });

  it("creates a new idea", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await waitFor(() => expect(screen.getByTestId("idea-title-idea_1")).toBeInTheDocument());
    fireEvent.change(getIdeaField("idea-title"), { target: { value: "New angle" } });

    await act(async () => {
      fireEvent.submit(screen.getByTestId("ideas-form"));
    });

    const ideaPost = fetchMock.mock.calls.find(([req, init]) => {
      const url = typeof req === "string" ? req : req instanceof Request ? req.url : "";
      return url.includes("/ideas") && (init?.method ?? "GET").toUpperCase() === "POST";
    });
    expect(ideaPost).toBeTruthy();
  });

  it("updates idea status", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await waitFor(() => expect(screen.getByTestId("idea-status-idea_1")).toBeInTheDocument());
    fireEvent.change(screen.getByTestId("idea-status-idea_1"), { target: { value: "approved" } });

    const ideaPatch = fetchMock.mock.calls.find(([req, init]) => {
      const url = typeof req === "string" ? req : req instanceof Request ? req.url : "";
      return url.includes("/ideas/idea_1") && (init?.method ?? "GET").toUpperCase() === "PATCH";
    });
    expect(ideaPatch).toBeTruthy();
  });
});

describe("SocialFlowWorkspaceClient channel signals", () => {
  it("loads signals for default channel and fills form", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await waitFor(() => expect(getSignalsField("signals-topics").value).toBe("launches"));
    expect(getSignalsField("signals-active-keywords").value).toContain("pilot");
    expect((getSignalsField("signals-trend-notes") as HTMLTextAreaElement).value).toContain("trending note");
  });

  it("saves updated signals", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await waitFor(() => expect(getSignalsField("signals-topics").value).toBe("launches"));
    fireEvent.change(getSignalsField("signals-topics"), { target: { value: "product" } });

    await act(async () => {
      fireEvent.submit(screen.getByTestId("signals-form"));
    });

    const signalsPost = fetchMock.mock.calls.find(([req, init]) => {
      const url = typeof req === "string" ? req : req instanceof Request ? req.url : "";
      return url.includes("/signals") && (init?.method ?? "GET").toUpperCase() === "POST";
    });
    expect(signalsPost).toBeTruthy();
  });
});

function buildPost(partial?: Partial<SaasSocialPost>): SaasSocialPost {
  return {
    id: "post_1",
    tenantId: "tenant_1",
    saasId: "saas_1",
    campaignId: null,
    channelId: channels[0].id,
    provider: "LINKEDIN",
    contentType: "FEED",
    title: "Hello",
    body: "Body",
    imageHint: null,
    status: "SCHEDULED",
    scheduledAt: new Date().toISOString(),
    postedAt: null,
    externalPostId: null,
    metadata: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

function buildProps(overrides?: Partial<React.ComponentProps<typeof SocialFlowWorkspaceClient>>): React.ComponentProps<typeof SocialFlowWorkspaceClient> {
  return {
    tenantId: "tenant_1",
    saasId: "saas_1",
    instance: { id: "saas_1", slug: "socialflow", name: "SocialFlow", custom_domain: null, trial_domain: null },
    workspaceBilling: { plan: "STARTER", status: "active", currentPeriodEnd: null, stripeConfigured: true },
    initialData: {
      summary: baseSummary,
      accounts: linkedInAccounts,
      campaigns,
      channels,
      posts: [buildPost()],
      calendar: { days: [], upcomingPosts: [] },
      analytics: baseSummary.analytics,
      tasks: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
    const method = (init?.method ?? "GET").toUpperCase();

    if (url.includes("/knowledge") && method === "GET") {
      return jsonResponse({ knowledge: channelKnowledge });
    }

    if (url.includes("/knowledge") && method === "POST") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return jsonResponse({ knowledge: { ...channelKnowledge, ...body, keywords: body.keywords ?? [], updatedAt: new Date().toISOString() } });
    }

    if (url.includes("/signals") && method === "GET") {
      return jsonResponse({ signals: channelSignals });
    }

    if (url.includes("/signals") && method === "POST") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return jsonResponse({ signals: { ...channelSignals, ...body, topics: body.topics ?? [], updatedAt: new Date().toISOString() } });
    }

    if (url.includes("/ideas") && method === "GET") {
      return jsonResponse({ ideas: channelIdeas });
    }

    if (url.includes("/ideas") && method === "POST") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return jsonResponse({ idea: { ...channelIdeas[0], ...body, id: "idea_new", status: body.status ?? "idea", updatedAt: new Date().toISOString() } });
    }

    if (url.includes("/ideas") && method === "PATCH") {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      return jsonResponse({ idea: { ...channelIdeas[0], ...body, updatedAt: new Date().toISOString() } });
    }

    if (method === "POST") {
      return jsonResponse({ id: "post_new" });
    }

    if (url.includes("/api/social/summary")) return jsonResponse({ summary: stableInitialPayload.summary });
    if (url.includes("/api/social/accounts")) return jsonResponse({ items: stableInitialPayload.accounts });
    if (url.includes("/api/social/campaigns")) return jsonResponse({ items: stableInitialPayload.campaigns });
    if (url.includes("/api/social/channels")) return jsonResponse({ items: stableInitialPayload.channels });
    if (url.includes("/api/social/posts")) return jsonResponse({ items: stableInitialPayload.posts });
    if (url.includes("/api/social/calendar")) return jsonResponse({ calendar: stableInitialPayload.calendar });
    if (url.includes("/api/social/analytics")) return jsonResponse({ analytics: stableInitialPayload.analytics });
    if (url.includes("/api/tasks")) return jsonResponse({ items: stableInitialPayload.tasks });

    return new Response(stableInitialPayloadJson, { status: 200, headers: { "content-type": "application/json" } });
  });
  // jsdom lacks scrollIntoView
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("SocialFlowWorkspaceClient LinkedIn account selection", () => {
  it("renders LinkedIn account selector when live accounts exist", () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    expect(getLinkedInAccountSelect()).toBeInTheDocument();
    linkedInAccounts.forEach((account) => {
      expect(screen.getByText(account.handle as string)).toBeInTheDocument();
    });
    expect(getChannelSelect()).toBeInTheDocument();
    expect(getChannelSelect().value).toBe(channels[0].id);
  });

  it("auto-selects a live account for scheduled publishing", async () => {
    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    await act(async () => {
      fireEvent.change(getStatusSelect(), { target: { value: "SCHEDULED" } });
    });
    fireEvent.change(getPublishingPathSelect(), { target: { value: "live" } });
    fireEvent.change(screen.getByTestId("post-scheduled-at") as HTMLInputElement, { target: { value: "2026-03-20T10:00" } });

    await act(async () => {
      fireEvent.submit(screen.getByText(/Create post/i).closest("form") as HTMLFormElement);
    });

    const postCalls = fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET").toUpperCase() === "POST");
    expect(postCalls.length).toBeGreaterThan(0);
  });

  it("persists accountId in metadata when creating a live post", async () => {
    fetchMock.mockClear();
    const base = stableInitialPayloadJson;
    fetchMock.mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof Request ? input.url : "";
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "POST") {
        return jsonResponse({ id: "post_new" });
      }
      if (url.includes("/api/social/summary")) return jsonResponse({ summary: stableInitialPayload.summary });
      if (url.includes("/api/social/accounts")) return jsonResponse({ items: stableInitialPayload.accounts });
      if (url.includes("/api/social/campaigns")) return jsonResponse({ items: stableInitialPayload.campaigns });
      if (url.includes("/api/social/channels")) return jsonResponse({ items: stableInitialPayload.channels });
      if (url.includes("/api/social/posts")) return jsonResponse({ items: stableInitialPayload.posts });
      if (url.includes("/api/social/calendar")) return jsonResponse({ calendar: stableInitialPayload.calendar });
      if (url.includes("/api/social/analytics")) return jsonResponse({ analytics: stableInitialPayload.analytics });
      if (url.includes("/api/tasks")) return jsonResponse({ items: stableInitialPayload.tasks });
      return new Response(base, { status: 200, headers: { "content-type": "application/json" } });
    });

    render(React.createElement(SocialFlowWorkspaceClient, buildProps()));

    fireEvent.change(getStatusSelect(), { target: { value: "SCHEDULED" } });
    fireEvent.change(getPublishingPathSelect(), { target: { value: "live" } });
    fireEvent.change(getLinkedInAccountSelect(), { target: { value: "acct_socialflow" } });
    fireEvent.change(getPostTitleInput(), { target: { value: "Post A" } });
    fireEvent.change(screen.getByText(/Body copy/i).parentElement?.querySelector("textarea") as HTMLTextAreaElement, { target: { value: "Body A" } });
    fireEvent.change(screen.getByTestId("post-scheduled-at") as HTMLInputElement, { target: { value: "2026-03-20T10:00" } });

    await act(async () => {
      fireEvent.submit(screen.getByText(/Create post/i).closest("form") as HTMLFormElement);
    });

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1));
    const postCall = fetchMock.mock.calls.find(([, init]) => (init?.method ?? "GET").toUpperCase() === "POST");
    expect(postCall).toBeTruthy();
    const [, requestInit] = postCall as [unknown, RequestInit];
    const parsed = JSON.parse((requestInit.body as string) ?? "{}");
    expect(parsed.metadata.publication.accountId).toBe("acct_socialflow");
  });

  it("loads accountId when editing a post", async () => {
    const postWithAccount = buildPost({
      id: "post_2",
      metadata: { publication: { mode: "live", accountId: "acct_socialflow" } },
    });
    const props = buildProps({ initialData: { ...buildProps().initialData, posts: [postWithAccount] } });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(props.initialData), { status: 200, headers: { "content-type": "application/json" } }),
    );

    render(React.createElement(SocialFlowWorkspaceClient, props));

    await act(async () => {
      fireEvent.click(screen.getByTestId("post-edit-post_2"));
    });

    await waitFor(() => expect(getLinkedInAccountSelect().value).toBe("acct_socialflow"));
  });

  it("shows the account used in the posts list", () => {
    const postWithAccount = buildPost({
      id: "post_3",
      metadata: { publication: { mode: "live", accountId: "acct_socialflow", accountHandle: "@socialflow" } },
    });
    const props = buildProps({ initialData: { ...buildProps().initialData, posts: [postWithAccount] } });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(props.initialData), { status: 200, headers: { "content-type": "application/json" } }),
    );

    render(React.createElement(SocialFlowWorkspaceClient, props));

    expect(screen.getByTestId("post-account-handle-post_3").textContent).toBe("@socialflow");
  });

  it("shows the channel used in the posts list", () => {
    const postWithChannel = buildPost({
      id: "post_4",
      channelId: channels[1].id,
    });
    const props = buildProps({ initialData: { ...buildProps().initialData, posts: [postWithChannel] } });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(props.initialData), { status: 200, headers: { "content-type": "application/json" } }),
    );

    render(React.createElement(SocialFlowWorkspaceClient, props));

    expect(screen.getByTestId("post-channel-post_4").textContent).toBe(channels[1].name);
  });
});
