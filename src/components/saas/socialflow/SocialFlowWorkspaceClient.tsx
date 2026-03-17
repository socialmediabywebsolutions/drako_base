"use client";

import React from "react";
import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import EmptyState from "@/components/ui/empty-state";
import Select from "@/components/ui/select";
import { Field, Help, TextArea, TextInput } from "@/components/ui/input";
import { getPostAnalyticsMetadata } from "@/lib/social/analytics-window";
import type {
  SaasSocialAccount,
  SaasSocialCampaign,
  SaasSocialChannel,
  SaasSocialChannelIdea,
  SaasSocialChannelIdeaStatus,
  SaasSocialChannelKnowledge,
  SaasSocialPost,
  SocialAnalyticsSnapshot,
  SocialAutomationRuleSummary,
  SocialCalendarSnapshot,
  SocialProductSummary,
} from "@/lib/social/types";
import type { SaasTask } from "@/lib/tasks/types";

type SocialFlowWorkspaceData = {
  summary: SocialProductSummary;
  accounts: SaasSocialAccount[];
  campaigns: SaasSocialCampaign[];
  channels: SaasSocialChannel[];
  posts: SaasSocialPost[];
  calendar: SocialCalendarSnapshot;
  analytics: SocialAnalyticsSnapshot;
  tasks: SaasTask[];
};

type SocialFlowWorkspaceClientProps = {
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
  initialData: SocialFlowWorkspaceData;
};

type FeedbackState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

type AccountFormState = {
  connectionMode: "demo" | "live";
  provider: "INSTAGRAM" | "TWITTER_X" | "LINKEDIN";
  handle: string;
  displayName: string;
  accessToken: string;
  isPrimary: boolean;
};

type CampaignFormState = {
  id: string | null;
  name: string;
  objective: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "FINISHED" | "ARCHIVED";
  targetSegment: string;
  budgetEstimate: string;
  notes: string;
};

type PostFormState = {
  id: string | null;
  campaignId: string;
  accountId: string;
  channelId: string;
  provider: "LINKEDIN";
  publicationMode: "demo" | "live";
  contentType: "FEED";
  title: string;
  body: string;
  status: "DRAFT" | "SCHEDULED";
  scheduledAt: string;
  imageHint: string;
};

type RuleFormState = {
  id: string | null;
  title: string;
  description: string;
  providers: string[];
  enabled: boolean;
};

type JsonError = {
  message?: string;
  error?: string;
  code?: string;
};

type ChannelKnowledgeForm = {
  channelId: string;
  objective: string;
  audience: string;
  tone: string;
  keywords: string;
  competitors: string;
  sources: string;
  updatedAt: string | null;
};

type ChannelSignalsForm = {
  channelId: string;
  topics: string;
  activeKeywords: string;
  trendNotes: string;
  watchedCompetitors: string;
  watchedSources: string;
  updatedAt: string | null;
};

type ChannelIdeaForm = {
  channelId: string;
  title: string;
  angle: string;
  summary: string;
};

const DEMO_PROVIDERS: Array<AccountFormState["provider"]> = ["INSTAGRAM", "TWITTER_X", "LINKEDIN"];

function formatProvider(provider: string) {
  switch (provider) {
    case "TWITTER_X":
      return "Twitter / X";
    case "INSTAGRAM":
      return "Instagram";
    case "LINKEDIN":
      return "LinkedIn";
    default:
      return provider;
  }
}

export function canPublishSocialPosts(summary: SocialProductSummary) {
  return summary.readiness.stage !== "GUIDED_SETUP";
}

function formatAccountStatus(status: string) {
  switch (status) {
    case "CONNECTED_DEMO":
      return "Demo";
    case "CONNECTED_REAL":
      return "Connected live";
    case "PENDING_REAL":
      return "Pending live";
    case "INVALID_CREDENTIALS":
      return "Invalid credentials";
    case "NEEDS_RECONNECTION":
      return "Needs reconnection";
    case "DISCONNECTED":
      return "Disconnected";
    default:
      return status.replaceAll("_", " ");
  }
}

function getAccountStatusTone(status: string) {
  switch (status) {
    case "CONNECTED_REAL":
      return "bg-emerald-100 text-emerald-700";
    case "CONNECTED_DEMO":
      return "bg-sky-100 text-sky-700";
    case "PENDING_REAL":
      return "bg-amber-100 text-amber-700";
    case "INVALID_CREDENTIALS":
    case "NEEDS_RECONNECTION":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

function getPublicationMeta(post: SaasSocialPost): {
  mode?: string;
  accountId?: string;
  accountHandle?: string;
  state?: string;
  lastAttemptAt?: string;
  externalPostId?: string;
  errorMessage?: string;
} | null {
  if (!post.metadata?.publication || typeof post.metadata.publication !== "object") return null;
  return post.metadata.publication as {
    mode?: string;
    accountId?: string;
    accountHandle?: string;
    state?: string;
    lastAttemptAt?: string;
    externalPostId?: string;
    errorMessage?: string;
  };
}

function getAnalyticsMeta(post: SaasSocialPost) {
  return getPostAnalyticsMetadata(post);
}

function formatAnalyticsSource(source: string | null | undefined) {
  switch (source) {
    case "live_linkedin":
      return "Live metrics";
    case "analytics_fallback":
      return "Analytics fallback";
    default:
      return "Placeholder metrics";
  }
}

function getAnalyticsRefreshTone(analyticsMeta: ReturnType<typeof getAnalyticsMeta>) {
  if (analyticsMeta?.lastRefreshStatus === "error") return "text-red-600";
  if (analyticsMeta?.source === "live_linkedin") return "text-emerald-700";
  return "text-slate-500";
}

function getAnalyticsHealthTone(status: "Healthy" | "Needs attention" | "No live analytics yet") {
  switch (status) {
    case "Healthy":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "Needs attention":
      return "border-amber-200 bg-amber-50 text-amber-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getHealthySyncFreshnessTone(status: "FRESH" | "AGING" | "NOT_AVAILABLE") {
  switch (status) {
    case "FRESH":
      return "border-emerald-200 bg-emerald-100 text-emerald-800";
    case "AGING":
      return "border-amber-200 bg-amber-100 text-amber-800";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function formatHealthySyncFreshness(status: "FRESH" | "AGING" | "NOT_AVAILABLE") {
  switch (status) {
    case "FRESH":
      return "Fresh";
    case "AGING":
      return "Aging";
    default:
      return "Not available";
  }
}

function getSyncActivityTone(state: "success" | "fallback" | "error" | "resolved" | string) {
  switch (state) {
    case "resolved":
      return "border-sky-100 bg-sky-50 text-sky-800";
    case "success":
      return "border-emerald-100 bg-emerald-50 text-emerald-800";
    case "fallback":
      return "border-amber-100 bg-amber-50 text-amber-800";
    default:
      return "border-red-100 bg-red-50 text-red-800";
  }
}

function getReviewedTone(reviewed: boolean | undefined) {
  return reviewed ? "border-slate-200 bg-slate-100 text-slate-700" : "border-transparent bg-transparent text-slate-400";
}

function canRetryAnalyticsPost(post: SaasSocialPost | null): post is SaasSocialPost {
  return post != null
    && post.provider === "LINKEDIN"
    && Boolean(post.externalPostId)
    && (post.status === "PUBLISHED" || post.status === "POSTED")
    && getPublicationMeta(post)?.mode === "live";
}

function getPostStateLabel(post: SaasSocialPost) {
  const publication = getPublicationMeta(post);
  const mode = publication?.mode;
  if (post.status === "SCHEDULED" && mode === "live") return "Scheduled live";
  if (post.status === "FAILED" && mode === "live") return "Failed live";
  if ((post.status === "PUBLISHED" || post.status === "POSTED") && mode === "live") return "Published live";
  if (post.status === "PUBLISHED" || post.status === "POSTED") return "Published demo";
  return post.status;
}

function getPostStateTone(post: SaasSocialPost) {
  const label = getPostStateLabel(post);
  if (label === "Published live") return "bg-emerald-100 text-emerald-700";
  if (label === "Scheduled live") return "bg-indigo-100 text-indigo-700";
  if (label === "Published demo") return "bg-sky-100 text-sky-700";
  if (label === "Failed live") return "bg-red-100 text-red-700";
  if (label === "SCHEDULED") return "bg-sky-100 text-sky-700";
  return "bg-slate-100 text-slate-600";
}

function formatRuleAction(rule: SocialAutomationRuleSummary | RuleTask) {
  const providers = parseRuleProviders(rule).map(formatProvider);
  const providersLabel = providers.length ? providers.join(", ") : "all connected channels";
  return `When a post reaches its scheduled time, publish it to ${providersLabel}.`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDayLabel(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function toDateTimeInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoDateTime(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function createEmptyCampaignForm(): CampaignFormState {
  return {
    id: null,
    name: "",
    objective: "",
    status: "ACTIVE",
    targetSegment: "",
    budgetEstimate: "",
    notes: "",
  };
}

function createEmptyPostForm(): PostFormState {
  return {
    id: null,
    campaignId: "",
    accountId: "",
    channelId: "",
    provider: "LINKEDIN",
    publicationMode: "demo",
    contentType: "FEED",
    title: "",
    body: "",
    status: "DRAFT",
    scheduledAt: "",
    imageHint: "",
  };
}

function createEmptyRuleForm(): RuleFormState {
  return {
    id: null,
    title: "Auto-publish when scheduled",
    description: "Publish scheduled SocialFlow content automatically when due.",
    providers: ["INSTAGRAM", "TWITTER_X", "LINKEDIN"],
    enabled: true,
  };
}

function createEmptyAccountForm(): AccountFormState {
  return {
    connectionMode: "demo",
    provider: "INSTAGRAM",
    handle: "",
    displayName: "",
    accessToken: "",
    isPrimary: false,
  };
}

type RuleTask = SaasTask & {
  metadata: {
    type?: string;
    trigger?: string;
    action?: string;
    scope?: {
      providers?: string[];
    };
  } | null;
};

function isAutomationRuleTask(task: SaasTask): task is RuleTask {
  return task.category === "SOCIAL" && task.metadata?.type === "automation_rule";
}

function parseRuleProviders(rule: { scope?: Record<string, unknown> | null; metadata?: { scope?: { providers?: string[] } } | null }) {
  const scope = typeof rule.scope !== "undefined" ? rule.scope : rule.metadata?.scope;
  if (!scope || typeof scope !== "object") return [];
  const providers = scope.providers;
  return Array.isArray(providers) ? providers.filter((value): value is string => typeof value === "string") : [];
}

function normalizeTasks(items: SaasTask[] | undefined) {
  return (items ?? []).filter(isAutomationRuleTask);
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & JsonError;
  if (!response.ok) {
    throw new Error(payload.message || payload.error || payload.code || "Request failed");
  }
  return payload;
}

function buildNextActionTarget(summary: SocialProductSummary) {
  const nextStep = summary.onboarding.steps.find((step) => !step.completed)?.key;
  switch (nextStep) {
    case "connect_account":
      return "accounts";
    case "create_campaign":
      return "campaigns";
    case "schedule_post":
      return "posts";
    case "activate_rule":
      return "rules";
    case "review_calendar_analytics":
      return "calendar";
    default:
      return "analytics";
  }
}

export default function SocialFlowWorkspaceClient({
  saasId,
  instance,
  workspaceBilling,
  initialData,
}: SocialFlowWorkspaceClientProps) {
  const [data, setData] = useState<SocialFlowWorkspaceData>(initialData);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [reviewedPostId, setReviewedPostId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<{ postId: string; note: string; source: "activity" | "incident" } | null>(null);
  const [accountForm, setAccountForm] = useState<AccountFormState>(createEmptyAccountForm);
  const [campaignForm, setCampaignForm] = useState<CampaignFormState>(createEmptyCampaignForm);
  const [postForm, setPostForm] = useState<PostFormState>(createEmptyPostForm);
  const [ruleForm, setRuleForm] = useState<RuleFormState>(createEmptyRuleForm);
  const [knowledgeForm, setKnowledgeForm] = useState<ChannelKnowledgeForm | null>(null);
  const [knowledgeChannelId, setKnowledgeChannelId] = useState<string>(initialData.channels[0]?.id ?? "");
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [signalsForm, setSignalsForm] = useState<ChannelSignalsForm | null>(null);
  const [signalsChannelId, setSignalsChannelId] = useState<string>(initialData.channels[0]?.id ?? "");
  const [isSignalsLoading, setIsSignalsLoading] = useState(false);
  const [ideas, setIdeas] = useState<SaasSocialChannelIdea[]>([]);
  const [ideasChannelId, setIdeasChannelId] = useState<string>(initialData.channels[0]?.id ?? "");
  const [ideaForm, setIdeaForm] = useState<ChannelIdeaForm>({ channelId: initialData.channels[0]?.id ?? "", title: "", angle: "", summary: "" });
  const [isIdeasLoading, setIsIdeasLoading] = useState(false);

  const automationRules = normalizeTasks(data.tasks);
  const connectedAccounts = data.accounts.filter((account) => account.status !== "DISCONNECTED");
  const liveLinkedInAccounts = data.accounts.filter((account) => account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL");
  const liveLinkedInAccount = data.accounts.find((account) => account.provider === "LINKEDIN" && account.status === "CONNECTED_REAL") ?? null;
  const defaultChannelId = data.channels[0]?.id ?? "";
  const activeCampaigns = data.campaigns.filter((campaign) => campaign.status === "ACTIVE");
  const archivedCampaigns = data.campaigns.filter((campaign) => campaign.status === "ARCHIVED");
  const recentPosts = [...data.posts].slice(0, 6);
  const liveAnalyticsPosts = data.posts.filter((post) => getAnalyticsMeta(post)?.source === "live_linkedin").length;
  const liveAnalyticsRefreshErrors = data.posts.filter((post) => getAnalyticsMeta(post)?.lastRefreshStatus === "error").length;
  const nextActionTarget = buildNextActionTarget(data.summary);
  const productModeLabel = instance.custom_domain ? "Custom-domain workspace" : "Trial-domain workspace";
  const healthySyncNeedsRefresh = data.summary.analyticsHealth.healthySyncNeedsRefresh;
  const readinessToneClass = data.summary.readiness.stage === "FIRST_PAYING_USER_READY"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : data.summary.readiness.stage === "EARLY_USER_READY"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : data.summary.readiness.stage === "PILOT_READY"
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : "border-amber-200 bg-amber-50 text-amber-800";
  const operationsToneClass = data.summary.operations.status === "ON_TRACK"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : data.summary.operations.status === "NEEDS_ATTENTION"
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-red-200 bg-red-50 text-red-800";
  const billingStatusLabel = workspaceBilling.status.replaceAll("_", " ");
  const isCommerciallyActive = ["active", "trialing"].includes(workspaceBilling.status.toLowerCase());
  const canStartPaidActivation = ["PILOT_READY", "FIRST_PAYING_USER_READY"].includes(data.summary.readiness.stage) && !isCommerciallyActive;
  const commercialHeadline = isCommerciallyActive
    ? `Workspace billing is active on ${workspaceBilling.plan}.`
    : canStartPaidActivation
      ? "This workspace is ready to activate paid billing."
      : "Finish the pilot loop before asking a customer to pay.";
  const commercialToneClass = isCommerciallyActive
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : canStartPaidActivation
      ? "border-sky-200 bg-sky-50 text-sky-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  async function loadWorkspaceData(): Promise<SocialFlowWorkspaceData> {
    const [summaryPayload, accountsPayload, campaignsPayload, channelsPayload, postsPayload, calendarPayload, analyticsPayload, tasksPayload] = await Promise.all([
      requestJson<{
        summary: SocialProductSummary;
      }>(`/api/social/summary?saasId=${saasId}`),
      requestJson<{
        items: SaasSocialAccount[];
      }>(`/api/social/accounts?saasId=${saasId}`),
      requestJson<{
        items: SaasSocialCampaign[];
      }>(`/api/social/campaigns?saasId=${saasId}`),
      requestJson<{
        items: SaasSocialChannel[];
      }>(`/api/social/channels?saasId=${saasId}`),
      requestJson<{
        items: SaasSocialPost[];
      }>(`/api/social/posts?saasId=${saasId}`),
      requestJson<{
        calendar: SocialCalendarSnapshot;
      }>(`/api/social/calendar?saasId=${saasId}`),
      requestJson<{
        analytics: SocialAnalyticsSnapshot;
      }>(`/api/social/analytics?saasId=${saasId}`),
      requestJson<{
        items: SaasTask[];
      }>(`/api/tasks?saasId=${saasId}&category=SOCIAL`),
    ]);

    return {
      summary: summaryPayload.summary,
      accounts: accountsPayload.items,
      campaigns: campaignsPayload.items,
      channels: channelsPayload.items,
      posts: postsPayload.items,
      calendar: calendarPayload.calendar,
      analytics: analyticsPayload.analytics,
      tasks: tasksPayload.items,
    };
  }

  async function refreshWorkspace(message?: string) {
    const snapshot = await loadWorkspaceData();
    startRefreshTransition(() => {
      setData(snapshot);
      if (message) {
        setFeedback({ tone: "success", message });
      }
    });
  }

  function buildEmptyKnowledge(channelId: string): ChannelKnowledgeForm {
    return {
      channelId,
      objective: "",
      audience: "",
      tone: "",
      keywords: "",
      competitors: "",
      sources: "",
      updatedAt: null,
    };
  }

  function buildEmptySignals(channelId: string): ChannelSignalsForm {
    return {
      channelId,
      topics: "",
      activeKeywords: "",
      trendNotes: "",
      watchedCompetitors: "",
      watchedSources: "",
      updatedAt: null,
    };
  }

  function listToInput(values: string[] | null | undefined): string {
    return (values ?? []).join(", ");
  }

  function inputToList(value: string): string[] {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function buildEmptyIdea(channelId: string): ChannelIdeaForm {
    return { channelId, title: "", angle: "", summary: "" };
  }

  async function loadChannelKnowledge(channelId: string) {
    setIsKnowledgeLoading(true);
    try {
      const payload = await requestJson<{ knowledge: SaasSocialChannelKnowledge }>(
        `/api/social/channels/${channelId}/knowledge?saasId=${saasId}`,
      );
      setKnowledgeForm({
        channelId,
        objective: payload.knowledge.objective ?? "",
        audience: payload.knowledge.audience ?? "",
        tone: payload.knowledge.tone ?? "",
        keywords: listToInput(payload.knowledge.keywords),
        competitors: listToInput(payload.knowledge.competitors),
        sources: listToInput(payload.knowledge.sources),
        updatedAt: payload.knowledge.updatedAt ?? null,
      });
    } catch (error) {
      setKnowledgeForm(buildEmptyKnowledge(channelId));
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load channel knowledge." });
    } finally {
      setIsKnowledgeLoading(false);
    }
  }

  async function loadChannelSignals(channelId: string) {
    setIsSignalsLoading(true);
    try {
      const payload = await requestJson<{ signals: ChannelSignalsForm }>(
        `/api/social/channels/${channelId}/signals?saasId=${saasId}`,
      );
      setSignalsForm({
        channelId,
        topics: listToInput(payload.signals.topics as unknown as string[]),
        activeKeywords: listToInput(payload.signals.activeKeywords as unknown as string[]),
        trendNotes: payload.signals.trendNotes ?? "",
        watchedCompetitors: listToInput(payload.signals.watchedCompetitors as unknown as string[]),
        watchedSources: listToInput(payload.signals.watchedSources as unknown as string[]),
        updatedAt: payload.signals.updatedAt ?? null,
      });
    } catch (error) {
      setSignalsForm(buildEmptySignals(channelId));
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load channel signals." });
    } finally {
      setIsSignalsLoading(false);
    }
  }

  async function handleKnowledgeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!knowledgeForm) return;
    await withAction(`knowledge-save-${knowledgeForm.channelId}`, async () => {
      const payload = await requestJson<{ knowledge: ChannelKnowledgeForm }>(
        `/api/social/channels/${knowledgeForm.channelId}/knowledge?saasId=${saasId}`,
        {
          method: "POST",
          body: JSON.stringify({
            objective: knowledgeForm.objective || null,
            audience: knowledgeForm.audience || null,
            tone: knowledgeForm.tone || null,
            keywords: inputToList(knowledgeForm.keywords),
            competitors: inputToList(knowledgeForm.competitors),
            sources: inputToList(knowledgeForm.sources),
          }),
        },
      );
      setKnowledgeForm({ ...knowledgeForm, updatedAt: payload.knowledge.updatedAt ?? new Date().toISOString() });
      setFeedback({ tone: "success", message: "Channel knowledge saved." });
    });
  }

  async function handleSignalsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!signalsForm) return;
    await withAction(`signals-save-${signalsForm.channelId}`, async () => {
      const payload = await requestJson<{ signals: ChannelSignalsForm }>(
        `/api/social/channels/${signalsForm.channelId}/signals?saasId=${saasId}`,
        {
          method: "POST",
          body: JSON.stringify({
            topics: inputToList(signalsForm.topics),
            activeKeywords: inputToList(signalsForm.activeKeywords),
            trendNotes: signalsForm.trendNotes || null,
            watchedCompetitors: inputToList(signalsForm.watchedCompetitors),
            watchedSources: inputToList(signalsForm.watchedSources),
          }),
        },
      );
      setSignalsForm({ ...signalsForm, updatedAt: payload.signals.updatedAt ?? new Date().toISOString() });
      setFeedback({ tone: "success", message: "Channel signals saved." });
    });
  }

  async function loadChannelIdeas(channelId: string) {
    setIsIdeasLoading(true);
    try {
      const payload = await requestJson<{ ideas?: SaasSocialChannelIdea[] }>(
        `/api/social/channels/${channelId}/ideas?saasId=${saasId}`,
      );
      setIdeas(payload.ideas ?? []);
      setIdeaForm((prev) => ({ ...(prev ?? buildEmptyIdea(channelId)), channelId }));
    } catch (error) {
      setIdeas([]);
      setIdeaForm(buildEmptyIdea(channelId));
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Unable to load channel ideas." });
    } finally {
      setIsIdeasLoading(false);
    }
  }

  async function handleIdeaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ideaForm.title.trim()) return;
    await withAction(`idea-save-${ideaForm.channelId}`, async () => {
      const payload = await requestJson<{ idea: SaasSocialChannelIdea }>(
        `/api/social/channels/${ideaForm.channelId}/ideas?saasId=${saasId}`,
        {
          method: "POST",
          body: JSON.stringify({
            title: ideaForm.title.trim(),
            angle: ideaForm.angle.trim() || null,
            summary: ideaForm.summary.trim() || null,
          }),
        },
      );
      setIdeas((prev) => [payload.idea, ...prev]);
      setIdeaForm(buildEmptyIdea(ideaForm.channelId));
      setFeedback({ tone: "success", message: "Channel idea added." });
    });
  }

  async function handleIdeaStatusChange(ideaId: string, status: SaasSocialChannelIdeaStatus) {
    await withAction(`idea-status-${ideaId}`, async () => {
      const payload = await requestJson<{ idea: SaasSocialChannelIdea }>(
        `/api/social/channels/${ideasChannelId}/ideas/${ideaId}?saasId=${saasId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
      );
      setIdeas((prev) => prev.map((idea) => (idea.id === ideaId ? payload.idea : idea)));
      setFeedback({ tone: "success", message: "Idea updated." });
    });
  }

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleReviewPost(postId: string) {
    setReviewedPostId(postId);
    scrollToSection(`post-card-${postId}`);
  }

  useEffect(() => {
    if (!data.posts.some((post) => (post.status === "PUBLISHED" || post.status === "POSTED") && post.provider === "LINKEDIN")) {
      return;
    }
    let cancelled = false;
    void loadWorkspaceData()
      .then((snapshot) => {
        if (cancelled) return;
        startRefreshTransition(() => {
          setData(snapshot);
        });
      })
      .catch(() => {
        // Keep the current workspace snapshot if the background analytics refresh fails.
      });
    return () => {
      cancelled = true;
    };
  }, [saasId]);

  useEffect(() => {
    if (postForm.id) return;
    if (!postForm.channelId && defaultChannelId) {
      setPostForm((prev) => ({ ...prev, channelId: defaultChannelId }));
    }
    if (!postForm.accountId && liveLinkedInAccount) {
      setPostForm((prev) => ({ ...prev, accountId: liveLinkedInAccount.id }));
    }
  }, [defaultChannelId, liveLinkedInAccount, postForm.accountId, postForm.channelId, postForm.id]);

  useEffect(() => {
    if (!knowledgeChannelId) return;
    void loadChannelKnowledge(knowledgeChannelId);
  }, [knowledgeChannelId]);

  useEffect(() => {
    if (!signalsChannelId) return;
    void loadChannelSignals(signalsChannelId);
  }, [signalsChannelId]);

  useEffect(() => {
    if (!ideasChannelId) return;
    void loadChannelIdeas(ideasChannelId);
  }, [ideasChannelId]);

  async function handleStartCheckout(plan: "PRO" | "ENTERPRISE") {
    await withAction(`checkout-${plan}`, async () => {
      const payload = await requestJson<{ url?: string; code?: string }>(`/api/billing/create-checkout`, {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      if (!payload.url) {
        throw new Error(payload.code ?? "Unable to open checkout.");
      }
      window.location.href = payload.url;
    });
  }

  async function withAction(actionKey: string, action: () => Promise<void>) {
    setActiveAction(actionKey);
    setFeedback(null);
    try {
      await action();
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "The action could not be completed.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withAction("account-submit", async () => {
      const status = accountForm.connectionMode === "live" ? "CONNECTED_REAL" : "CONNECTED_DEMO";
      const payload = await requestJson<{
        account: SaasSocialAccount;
        liveConnection?: { ok: boolean; code: string; message: string };
      }>(`/api/social/accounts`, {
        method: "POST",
        body: JSON.stringify({
          saasId,
          provider: accountForm.connectionMode === "live" ? "LINKEDIN" : accountForm.provider,
          handle: accountForm.handle.trim() || null,
          displayName: accountForm.displayName.trim() || null,
          status,
          authMeta: accountForm.connectionMode === "live"
            ? {
                mode: "live",
                accessToken: accountForm.accessToken.trim(),
                connection_note: "Manual LinkedIn live connection for first-paying-user validation.",
              }
            : {
                mode: "demo",
                token_status: "active",
                connection_note: "Demo social connection for first-user walkthroughs.",
              },
          isPrimary: accountForm.connectionMode === "live" ? true : accountForm.isPrimary,
        }),
      });
      setAccountForm(createEmptyAccountForm());
      await refreshWorkspace(
        accountForm.connectionMode === "live"
          ? payload.liveConnection?.ok
            ? "LinkedIn live connection verified."
            : payload.liveConnection?.message ?? "LinkedIn live connection saved with follow-up required."
          : `${formatProvider(accountForm.provider)} connected in demo mode.`,
      );
      if (accountForm.connectionMode === "live" && payload.liveConnection && !payload.liveConnection.ok) {
        setFeedback({
          tone: "error",
          message: payload.liveConnection.message,
        });
      }
    });
  }

  async function handlePrimaryAccount(accountId: string) {
    await withAction(`account-primary-${accountId}`, async () => {
      await requestJson(`/api/social/accounts`, {
        method: "PATCH",
        body: JSON.stringify({
          id: accountId,
          saasId,
          isPrimary: true,
        }),
      });
      await refreshWorkspace("Primary account updated.");
    });
  }

  async function handleDisconnectAccount(accountId: string) {
    await withAction(`account-disconnect-${accountId}`, async () => {
      await requestJson(`/api/social/accounts`, {
        method: "DELETE",
        body: JSON.stringify({
          id: accountId,
          saasId,
        }),
      });
      await refreshWorkspace("Account disconnected from the active demo set.");
    });
  }

  async function handleCampaignSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withAction("campaign-submit", async () => {
      const method = campaignForm.id ? "PATCH" : "POST";
      await requestJson(`/api/social/campaigns`, {
        method,
        body: JSON.stringify({
          id: campaignForm.id,
          saasId,
          name: campaignForm.name.trim(),
          objective: campaignForm.objective.trim(),
          status: campaignForm.status,
          targetSegment: campaignForm.targetSegment.trim(),
          budgetEstimate: campaignForm.budgetEstimate ? Number(campaignForm.budgetEstimate) : null,
          notes: campaignForm.notes.trim() || null,
        }),
      });
      const message = campaignForm.id ? "Campaign updated." : "Campaign created.";
      setCampaignForm(createEmptyCampaignForm);
      await refreshWorkspace(message);
    });
  }

  function handleCampaignEdit(campaign: SaasSocialCampaign) {
    setCampaignForm({
      id: campaign.id,
      name: campaign.name,
      objective: campaign.objective,
      status: campaign.status,
      targetSegment: campaign.targetSegment,
      budgetEstimate: campaign.budgetEstimate == null ? "" : String(campaign.budgetEstimate),
      notes: campaign.notes ?? "",
    });
    scrollToSection("campaigns");
  }

  async function handleCampaignStatus(campaign: SaasSocialCampaign, status: CampaignFormState["status"]) {
    await withAction(`campaign-status-${campaign.id}-${status}`, async () => {
      await requestJson(`/api/social/campaigns`, {
        method: "PATCH",
        body: JSON.stringify({
          id: campaign.id,
          saasId,
          status,
        }),
      });
      await refreshWorkspace(`Campaign moved to ${status.toLowerCase()}.`);
    });
  }

  async function handlePostSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withAction("post-submit", async () => {
      const publicationMode = postForm.status === "SCHEDULED" ? "live" : "demo";
      const canPublishNow = canPublishSocialPosts(data.summary);
      if (postForm.status === "SCHEDULED" && !postForm.scheduledAt) {
        throw new Error("Pick a scheduled time before saving a scheduled post.");
      }
      if (postForm.provider !== "LINKEDIN") {
        throw new Error("SocialFlow P0 supports LinkedIn posts only.");
      }
      if (postForm.status === "SCHEDULED") {
        if (!liveLinkedInAccount) {
          throw new Error("Connect one live LinkedIn account before scheduling live publishing.");
        }
        if (!canPublishNow) {
          throw new Error("Workspace readiness (billing + LinkedIn) is required before scheduling live publishing.");
        }
      }
      if (publicationMode === "live" && !postForm.accountId) {
        throw new Error("Select a live LinkedIn account for publishing.");
      }
      await requestJson(`/api/social/posts`, {
        method: "POST",
        body: JSON.stringify({
          id: postForm.id,
          saasId,
          campaignId: postForm.campaignId || null,
          channelId: postForm.channelId || null,
          provider: "LINKEDIN",
          contentType: "FEED",
          title: postForm.title.trim(),
          body: postForm.body.trim(),
          status: postForm.status,
          scheduledAt: postForm.status === "SCHEDULED" ? toIsoDateTime(postForm.scheduledAt) : null,
          imageHint: postForm.imageHint.trim() || null,
          metadata: {
            source: "socialflow_workspace",
            placeholder: publicationMode !== "live",
            publication: {
              mode: publicationMode,
              state: publicationMode === "live" && postForm.status === "SCHEDULED" ? "scheduled" : undefined,
              accountId: publicationMode === "live" ? postForm.accountId : undefined,
            },
          },
        }),
      });
      const message = postForm.id ? "Post updated." : "Post saved to the queue.";
      setPostForm(createEmptyPostForm);
      await refreshWorkspace(message);
    });
  }

  function handlePostEdit(post: SaasSocialPost) {
    const publication = getPublicationMeta(post);
    setPostForm({
      id: post.id,
      campaignId: post.campaignId ?? "",
      accountId: publication?.accountId ? String(publication.accountId) : "",
      channelId: post.channelId ?? defaultChannelId,
      provider: "LINKEDIN",
      contentType: "FEED",
      title: post.title,
      body: post.body,
      status: post.status === "DRAFT" ? "DRAFT" : "SCHEDULED",
      scheduledAt: toDateTimeInputValue(post.scheduledAt),
      imageHint: post.imageHint ?? "",
      publicationMode: publication?.mode === "live" ? "live" : "demo",
    });
    scrollToSection("posts");
  }

  async function handlePublishNow(post: SaasSocialPost) {
    await withAction(`post-publish-${post.id}`, async () => {
      if (!canPublishSocialPosts(data.summary)) {
        throw new Error("Workspace readiness (billing + LinkedIn) is required before publishing.");
      }
      if (!liveLinkedInAccount) {
        throw new Error("Connect one live LinkedIn account before publishing.");
      }
      await requestJson(`/api/social/posts/${post.id}?saasId=${saasId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "publish_live",
        }),
      });
      await refreshWorkspace(`"${post.title}" published to LinkedIn live.`);
    });
  }

  async function handlePublishLive(post: SaasSocialPost) {
    setActiveAction(`post-publish-live-${post.id}`);
    setFeedback(null);
    try {
      if (!canPublishSocialPosts(data.summary)) {
        throw new Error("Workspace readiness (billing + LinkedIn) is required before publishing.");
      }
      if (!liveLinkedInAccount) {
        throw new Error("Connect one live LinkedIn account before publishing.");
      }
      const payload = await requestJson<{
        post: SaasSocialPost;
        livePublish: { ok: boolean; code: string; message: string };
      }>(`/api/social/posts/${post.id}?saasId=${saasId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "publish_live",
        }),
      });
      const snapshot = await loadWorkspaceData();
      startRefreshTransition(() => {
        setData(snapshot);
        setFeedback({
          tone: payload.livePublish.ok ? "success" : "error",
          message: payload.livePublish.message,
        });
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Live publish failed.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRefreshLiveAnalytics(post: SaasSocialPost) {
    setActiveAction(`post-refresh-analytics-${post.id}`);
    setFeedback(null);
    try {
      const payload = await requestJson<{
        post: SaasSocialPost;
        liveAnalytics: { ok: boolean; code: string; message: string };
      }>(`/api/social/posts/${post.id}?saasId=${saasId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "refresh_live_analytics",
        }),
      });
      const snapshot = await loadWorkspaceData();
      startRefreshTransition(() => {
        setData(snapshot);
        setFeedback({
          tone: payload.liveAnalytics.ok ? "success" : "error",
          message: payload.liveAnalytics.message,
        });
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Live analytics refresh failed.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleMarkAnalyticsReviewed(postId: string, note?: string | null) {
    setActiveAction(`post-review-analytics-${postId}`);
    setFeedback(null);
    try {
      const payload = await requestJson<{
        post: SaasSocialPost;
        review: { ok: boolean; code: string; message: string };
      }>(`/api/social/posts/${postId}?saasId=${saasId}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "mark_analytics_reviewed",
          manualReviewNote: note ?? null,
        }),
      });
      const snapshot = await loadWorkspaceData();
      startRefreshTransition(() => {
        setData(snapshot);
        setReviewDraft((current) => (current?.postId === postId ? null : current));
        setFeedback({
          tone: payload.review.ok ? "success" : "error",
          message: payload.review.message,
        });
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Could not mark the analytics incident as reviewed.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  function openReviewDraft(postId: string, source: "activity" | "incident", note?: string | null) {
    setReviewDraft({ postId, source, note: note ?? "" });
  }

  function cancelReviewDraft(postId: string) {
    setReviewDraft((current) => (current?.postId === postId ? null : current));
  }

  function updateReviewDraft(postId: string, note: string) {
    setReviewDraft((current) => (current?.postId === postId ? { ...current, note } : { postId, source: "incident", note }));
  }

  async function saveReviewDraft(postId: string) {
    const note = reviewDraft?.postId === postId ? reviewDraft.note : "";
    await handleMarkAnalyticsReviewed(postId, note.trim() ? note.trim() : null);
  }

  async function handleRefreshWorkspaceLiveAnalytics() {
    setActiveAction("workspace-live-analytics-refresh");
    setFeedback(null);
    try {
      const payload = await requestJson<{
        refresh: {
          ok: boolean;
          refreshedCount: number;
          failedCount: number;
          finishedAt: string;
          message: string;
        };
      }>(`/api/social/analytics`, {
        method: "POST",
        body: JSON.stringify({
          saasId,
          action: "refresh_live_analytics",
        }),
      });
      const snapshot = await loadWorkspaceData();
      startRefreshTransition(() => {
        setData(snapshot);
        setFeedback({
          tone: payload.refresh.ok ? "success" : "error",
          message: `${payload.refresh.message} Last sync finished at ${formatDateTime(payload.refresh.finishedAt)}.`,
        });
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Workspace live analytics refresh failed.",
      });
    } finally {
      setActiveAction(null);
    }
  }

  async function handleRuleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await withAction("rule-submit", async () => {
      const payload = {
        title: ruleForm.title.trim(),
        description: ruleForm.description.trim() || null,
        status: ruleForm.enabled ? "OPEN" : "DISCARDED",
        metadata: {
          type: "automation_rule",
          trigger: "post.scheduled",
          action: "publish.placeholder",
          scope: {
            providers: ruleForm.providers,
          },
        },
      };

      if (ruleForm.id) {
        await requestJson(`/api/tasks/${ruleForm.id}?saasId=${saasId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await requestJson(`/api/tasks`, {
          method: "POST",
          body: JSON.stringify({
            saasId,
            category: "SOCIAL",
            severity: "SUGGESTION",
            source: "MANUAL_OWNER",
            ...payload,
          }),
        });
      }

      const message = ruleForm.id ? "Automation rule updated." : "Auto-publish rule created.";
      setRuleForm(createEmptyRuleForm);
      await refreshWorkspace(message);
    });
  }

  function handleRuleEdit(rule: RuleTask) {
    setRuleForm({
      id: rule.id,
      title: rule.title,
      description: rule.description ?? "",
      providers: parseRuleProviders(rule),
      enabled: rule.status !== "DONE" && rule.status !== "DISCARDED",
    });
    scrollToSection("rules");
  }

  async function handleRuleToggle(rule: RuleTask, enabled: boolean) {
    await withAction(`rule-toggle-${rule.id}`, async () => {
      await requestJson(`/api/tasks/${rule.id}?saasId=${saasId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: enabled ? "OPEN" : "DISCARDED",
          metadata: {
            ...(rule.metadata ?? {}),
            type: "automation_rule",
          },
        }),
      });
      await refreshWorkspace(enabled ? "Auto-publish rule enabled." : "Auto-publish rule paused.");
    });
  }

  async function handleRunPublishCheck() {
    await withAction("publish-check", async () => {
      const before = data.analytics.last30Days.publishedPosts;
      const snapshot = await loadWorkspaceData();
      const delta = snapshot.analytics.last30Days.publishedPosts - before;
      startRefreshTransition(() => {
        setData(snapshot);
        setFeedback({
          tone: "success",
          message: delta > 0
            ? `${delta} scheduled post${delta === 1 ? "" : "s"} moved into Published.`
            : "No scheduled posts were due yet. Calendar and analytics are up to date.",
        });
      });
    });
  }

  function toggleRuleProvider(provider: string) {
    setRuleForm((current) => ({
      ...current,
      providers: current.providers.includes(provider)
        ? current.providers.filter((item) => item !== provider)
        : [...current.providers, provider],
    }));
  }

  const feedbackToneClass = feedback?.tone === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : feedback?.tone === "info"
      ? "border-slate-200 bg-slate-50 text-slate-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  function renderReviewComposer(postId: string, source: "activity" | "incident") {
    if (reviewDraft?.postId !== postId || reviewDraft.source !== source) return null;
    return (
      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Manual review note</div>
        <textarea
          className="mt-2 min-h-[72px] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white"
          placeholder="Optional note for the operator trail."
          value={reviewDraft.note}
          onChange={(event) => updateReviewDraft(postId, event.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            loading={activeAction === `post-review-analytics-${postId}`}
            onClick={() => void saveReviewDraft(postId)}
          >
            Save review
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={activeAction === `post-review-analytics-${postId}`}
            onClick={() => cancelReviewDraft(postId)}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-sky-200 bg-[linear-gradient(135deg,#f8fcff_0%,#eef8ff_48%,#ffffff_100%)] shadow-[0_24px_90px_-48px_rgba(14,116,144,0.45)]">
        <div className="grid gap-6 px-8 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-sky-200 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-sky-700">
                SocialFlow
              </span>
              <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.24em] text-green-700">
                {data.summary.presentation.demoStage}
              </span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                {data.summary.presentation.stageLabel}
              </span>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Social media scheduling and automation in one operator-ready workspace.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                Connect channels, launch campaigns, queue posts, run the auto-publish loop, and review early engagement without leaving the tenant workspace.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.2em]">Workspace status</div>
                <div className="mt-2 text-lg font-bold text-slate-900">{data.summary.presentation.stageLabel}</div>
                <div className="mt-1 text-sm text-slate-600">{data.summary.presentation.confidenceNote}</div>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Current domain</div>
                <div className="mt-2 break-all font-mono text-sm font-semibold text-slate-900">
                  {instance.custom_domain || instance.trial_domain || `${instance.slug}.drako.systems`}
                </div>
                <div className="mt-1 text-sm text-slate-600">Custom domains stay optional. Demo walkthroughs run cleanly on the trial hostname too.</div>
              </div>
              <div className="rounded-2xl border border-sky-950 p-4 text-white shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-sky-200">Next step</div>
                <div className="mt-2 text-lg font-bold">{data.summary.onboarding.nextAction}</div>
                <div className="mt-1 text-sm text-sky-100">
                  {data.summary.onboarding.completedSteps} of {data.summary.onboarding.totalSteps} onboarding milestones completed.
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Product contract</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">Provisioned SaaS child on the shared tenant workspace</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Workspace mode</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">{productModeLabel}</div>
              </div>
              <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Operator loop</div>
                <div className="mt-1 text-sm font-semibold text-slate-900">
                  {connectedAccounts.length} channel{connectedAccounts.length === 1 ? "" : "s"} · {activeCampaigns.length} active campaign{activeCampaigns.length === 1 ? "" : "s"} · {automationRules.length} rule{automationRules.length === 1 ? "" : "s"}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => scrollToSection(nextActionTarget)} size="lg">
                Continue setup
              </Button>
              <Button variant="secondary" size="lg" onClick={() => scrollToSection("accounts")}>
                Connect channel
              </Button>
              <Button variant="secondary" size="lg" onClick={() => scrollToSection("campaigns")}>
                Create campaign
              </Button>
              <Button variant="secondary" size="lg" onClick={() => scrollToSection("posts")}>
                Queue post
              </Button>
              <Button variant="secondary" size="lg" onClick={() => scrollToSection("calendar")}>
                Open calendar
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => void handleRunPublishCheck()}
                loading={activeAction === "publish-check"}
              >
                Run publish check
              </Button>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => void withAction("workspace-refresh", () => refreshWorkspace("Workspace refreshed."))}
                loading={activeAction === "workspace-refresh" || isRefreshing}
              >
                Refresh workspace
              </Button>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-sky-100 bg-white/90 p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">First operator path</div>
                <div className="mt-1 text-xl font-bold text-slate-950">Make the first walkthrough obvious</div>
              </div>
              <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-800">
                {data.summary.onboarding.progressPercent}%
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0284c7_0%,#0f766e_100%)] transition-all"
                style={{ width: `${data.summary.onboarding.progressPercent}%` }}
              />
            </div>
            <div className="space-y-3">
              {data.summary.onboarding.steps.map((step, index) => (
                <div key={step.key} className="flex items-start gap-3 rounded-2xl border border-slate-100 px-4 py-3">
                  <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${step.completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {step.completed ? "OK" : index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{step.label}</div>
                    <div className="mt-1 text-sm text-slate-600">{step.hint}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {feedback ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${feedbackToneClass}`}>
          {feedback.message}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className={`rounded-[1.75rem] border px-6 py-5 shadow-sm ${operationsToneClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em]">Operator command center</div>
              <div className="mt-2 text-2xl font-black">{data.summary.operations.headline}</div>
              <p className="mt-2 max-w-3xl text-sm leading-6">
                This block tells the operator what still blocks a stronger pilot and what is already moving inside the live workspace.
              </p>
            </div>
            <div className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em]">
              {data.summary.operations.status.replaceAll("_", " ")}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4 xl:grid-cols-9">
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Due now</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.dueNowPosts}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Next 24h</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.scheduledNext24Hours}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Drafts</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.draftPosts}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Published 7d</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.publishedLast7Days}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Scheduled live</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.scheduledLivePosts}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Due live</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.dueLivePosts}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Failed live</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.failedLivePosts}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Live metrics</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.liveAnalyticsPosts}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Sync issues</div>
              <div className="mt-1 text-xl font-black">{data.summary.operations.counts.liveAnalyticsRefreshErrors}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Pilot actions</div>
          <div className="mt-2 text-xl font-black text-slate-950">What to do next</div>
          <div className="mt-4 space-y-3">
            {data.summary.operations.criticalActions.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                No critical setup blockers remain. Use the calendar, publish loop, and analytics to drive the pilot.
              </div>
            ) : (
              data.summary.operations.criticalActions.map((item) => (
                <div key={item} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  {item}
                </div>
              ))
            )}
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Next milestones</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {data.summary.operations.nextMilestones.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="font-black text-sky-600">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card title="Connected Accounts" subtitle="Live demo channels" className="min-h-[184px]">
          <div className="text-4xl font-black text-slate-950">{data.summary.overview.connectedAccounts}</div>
          <div className="mt-2 text-sm text-slate-600">Instagram, LinkedIn, and X can be connected in demo mode for first-user walkthroughs.</div>
        </Card>
        <Card title="Active Campaigns" subtitle="Running initiatives" className="min-h-[184px]">
          <div className="text-4xl font-black text-slate-950">{data.summary.overview.activeCampaigns}</div>
          <div className="mt-2 text-sm text-slate-600">Campaigns keep posts grouped by audience, objective, and budget.</div>
        </Card>
        <Card title="Scheduled This Week" subtitle="Upcoming queue" className="min-h-[184px]">
          <div className="text-4xl font-black text-slate-950">{data.summary.overview.scheduledPostsThisWeek}</div>
          <div className="mt-2 text-sm text-slate-600">
            These items still appear in the calendar and will move into Published when they become due.
          </div>
        </Card>
        <Card title="Published Last 30 Days" subtitle="Completed loop" className="min-h-[184px]">
          <div className="text-4xl font-black text-slate-950">{data.summary.overview.publishedPostsLast30Days}</div>
          <div className="mt-2 text-sm text-slate-600">
            {liveAnalyticsPosts > 0
              ? `${liveAnalyticsPosts} live LinkedIn post${liveAnalyticsPosts === 1 ? "" : "s"} already contribute real engagement metrics.`
              : "Published posts still use placeholder metrics until live engagement data is available."}
          </div>
        </Card>
        <Card title="Engagement Last 30 Days" subtitle="Operator KPI" tone="brand" className="min-h-[184px]">
          <div className="text-4xl font-black text-sky-800">{data.summary.overview.engagementLast30Days}</div>
          <div className="mt-2 text-sm text-sky-800">
            Top provider: {data.analytics.last30Days.topProvider ? formatProvider(data.analytics.last30Days.topProvider) : "None yet"}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card
          title="Channel signals"
          subtitle="Track evolving topics and watchlist"
          className="xl:col-span-7"
          bodyClassName="space-y-4"
        >
          <form className="space-y-4" onSubmit={(event) => void handleSignalsSubmit(event)} data-testid="signals-form">
            <div className="grid gap-4 md:grid-cols-[0.5fr_1.5fr]">
              <Field label="Channel" help="Pick the channel to edit its signals.">
                <Select
                  value={signalsChannelId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSignalsChannelId(next);
                  }}
                  data-testid="signals-channel-select"
                >
                  {data.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Topics" help="Comma-separated">
                <TextInput
                  value={signalsForm?.topics ?? ""}
                  onChange={(event) => setSignalsForm((prev) => (prev ? { ...prev, topics: event.target.value } : prev))}
                  placeholder="launches, lifecycle"
                  data-testid="signals-topics"
                />
              </Field>
              <Field label="Active keywords" help="Comma-separated">
                <TextInput
                  value={signalsForm?.activeKeywords ?? ""}
                  onChange={(event) =>
                    setSignalsForm((prev) => (prev ? { ...prev, activeKeywords: event.target.value } : prev))
                  }
                  placeholder="pilot, retention"
                  data-testid="signals-active-keywords"
                />
              </Field>
            </div>

            <Field label="Trend notes">
              <TextArea
                value={signalsForm?.trendNotes ?? ""}
                onChange={(event) => setSignalsForm((prev) => (prev ? { ...prev, trendNotes: event.target.value } : prev))}
                placeholder="What is trending for this channel"
                data-testid="signals-trend-notes"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Watched competitors" help="Comma-separated">
                <TextInput
                  value={signalsForm?.watchedCompetitors ?? ""}
                  onChange={(event) =>
                    setSignalsForm((prev) => (prev ? { ...prev, watchedCompetitors: event.target.value } : prev))
                  }
                  placeholder="alt1, alt2"
                  data-testid="signals-watched-competitors"
                />
              </Field>
              <Field label="Watched sources" help="Comma-separated">
                <TextInput
                  value={signalsForm?.watchedSources ?? ""}
                  onChange={(event) => setSignalsForm((prev) => (prev ? { ...prev, watchedSources: event.target.value } : prev))}
                  placeholder="feeds, newsletters"
                  data-testid="signals-watched-sources"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={activeAction === `signals-save-${signalsChannelId}`} disabled={isSignalsLoading || !signalsForm} data-testid="signals-save">
                Save signals
              </Button>
              {signalsForm?.updatedAt ? (
                <span className="text-xs text-slate-500">Updated at {new Date(signalsForm.updatedAt).toLocaleString()}</span>
              ) : null}
              {isSignalsLoading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>
          </form>
        </Card>

        <Card
          title="Signals usage"
          subtitle="Guide content and monitoring"
          className="xl:col-span-5"
          bodyClassName="space-y-3"
        >
          <p className="text-sm text-slate-700">Keep a quick list of topics, active keywords, and watchlists that influence planning.</p>
          <p className="text-sm text-slate-600">Signals are lightweight notes to steer ideation without changing the core knowledge base.</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card
          title="Channel ideas"
          subtitle="Capture quick content angles"
          className="xl:col-span-7"
          bodyClassName="space-y-4"
        >
          <form className="space-y-4" onSubmit={(event) => void handleIdeaSubmit(event)} data-testid="ideas-form">
            <div className="grid gap-4 md:grid-cols-[0.5fr_1.5fr]">
              <Field label="Channel" help="Pick the channel to manage ideas.">
                <Select
                  value={ideasChannelId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setIdeasChannelId(next);
                    setIdeaForm(buildEmptyIdea(next));
                  }}
                  data-testid="ideas-channel-select"
                >
                  {data.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Title">
                <TextInput
                  value={ideaForm.title}
                  onChange={(event) => setIdeaForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Idea title"
                  data-testid="idea-title"
                />
              </Field>
              <Field label="Angle">
                <TextInput
                  value={ideaForm.angle}
                  onChange={(event) => setIdeaForm((prev) => ({ ...prev, angle: event.target.value }))}
                  placeholder="Hook or POV"
                  data-testid="idea-angle"
                />
              </Field>
              <Field label="Summary">
                <TextInput
                  value={ideaForm.summary}
                  onChange={(event) => setIdeaForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="One-liner"
                  data-testid="idea-summary"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={activeAction === `idea-save-${ideasChannelId}`} disabled={isIdeasLoading || !ideaForm.title.trim()} data-testid="idea-save">
                Add idea
              </Button>
              {isIdeasLoading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>
          </form>

          <div className="space-y-3" data-testid="ideas-list">
            {ideas.length === 0 ? (
              <div className="text-sm text-slate-500">No ideas yet.</div>
            ) : (
              ideas.map((idea) => (
                <div key={idea.id} className="rounded-xl border border-slate-100 bg-white px-4 py-3" data-testid={`idea-card-${idea.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900" data-testid={`idea-title-${idea.id}`}>
                        {idea.title}
                      </div>
                      <div className="text-xs text-slate-600">
                        {idea.angle || ""}
                        {idea.summary ? (idea.angle ? " • " : "") + idea.summary : ""}
                      </div>
                    </div>
                    <Select
                      value={idea.status}
                      onChange={(event) => handleIdeaStatusChange(idea.id, event.target.value as SaasSocialChannelIdeaStatus)}
                      data-testid={`idea-status-${idea.id}`}
                    >
                      <option value="idea">Idea</option>
                      <option value="approved">Approved</option>
                      <option value="converted">Converted</option>
                      <option value="discarded">Discarded</option>
                    </Select>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card
          title="Ideas guidance"
          subtitle="Track potential angles"
          className="xl:col-span-5"
          bodyClassName="space-y-3"
        >
          <p className="text-sm text-slate-700">Capture lightweight ideas per channel before turning them into campaigns or posts.</p>
          <p className="text-sm text-slate-600">Update status as soon as an idea is approved, converted, or discarded.</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card
          title="Channel knowledge"
          subtitle="Keep each channel's editorial context accessible"
          className="xl:col-span-7"
          bodyClassName="space-y-4"
        >
          <form className="space-y-4" onSubmit={(event) => void handleKnowledgeSubmit(event)} data-testid="knowledge-form">
            <div className="grid gap-4 md:grid-cols-[0.5fr_1.5fr]">
              <Field label="Channel" help="Pick the channel to edit its knowledge base.">
                <Select
                  value={knowledgeChannelId}
                  onChange={(event) => {
                    const next = event.target.value;
                    setKnowledgeChannelId(next);
                  }}
                  data-testid="knowledge-channel-select"
                >
                  {data.channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Objective">
                <TextInput
                  value={knowledgeForm?.objective ?? ""}
                  onChange={(event) => setKnowledgeForm((prev) => (prev ? { ...prev, objective: event.target.value } : prev))}
                  placeholder="Example: B2B operators automation"
                  data-testid="knowledge-objective"
                />
              </Field>
              <Field label="Audience">
                <TextInput
                  value={knowledgeForm?.audience ?? ""}
                  onChange={(event) => setKnowledgeForm((prev) => (prev ? { ...prev, audience: event.target.value } : prev))}
                  placeholder="Operators"
                  data-testid="knowledge-audience"
                />
              </Field>
            </div>

            <Field label="Tone">
              <TextInput
                value={knowledgeForm?.tone ?? ""}
                onChange={(event) => setKnowledgeForm((prev) => (prev ? { ...prev, tone: event.target.value } : prev))}
                placeholder="Direct, concise"
                data-testid="knowledge-tone"
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Keywords" help="Comma-separated">
                <TextInput
                  value={knowledgeForm?.keywords ?? ""}
                  onChange={(event) => setKnowledgeForm((prev) => (prev ? { ...prev, keywords: event.target.value } : prev))}
                  placeholder="pilot, loop"
                  data-testid="knowledge-keywords"
                />
              </Field>
              <Field label="Competitors" help="Comma-separated">
                <TextInput
                  value={knowledgeForm?.competitors ?? ""}
                  onChange={(event) => setKnowledgeForm((prev) => (prev ? { ...prev, competitors: event.target.value } : prev))}
                  placeholder="alt1"
                  data-testid="knowledge-competitors"
                />
              </Field>
              <Field label="Sources" help="Comma-separated">
                <TextInput
                  value={knowledgeForm?.sources ?? ""}
                  onChange={(event) => setKnowledgeForm((prev) => (prev ? { ...prev, sources: event.target.value } : prev))}
                  placeholder="brief, deck"
                  data-testid="knowledge-sources"
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" loading={activeAction === `knowledge-save-${knowledgeChannelId}`} disabled={isKnowledgeLoading || !knowledgeForm} data-testid="knowledge-save">
                Save knowledge
              </Button>
              {knowledgeForm?.updatedAt ? (
                <span className="text-xs text-slate-500">Updated at {new Date(knowledgeForm.updatedAt).toLocaleString()}</span>
              ) : null}
              {isKnowledgeLoading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>
          </form>
        </Card>

        <Card
          title="Channel playbook"
          subtitle="Keep messaging aligned"
          className="xl:col-span-5"
          bodyClassName="space-y-3"
        >
          <p className="text-sm text-slate-700">
            Store per-channel niche, audience, tone, and references so operators stay consistent while scheduling posts.
          </p>
          <p className="text-sm text-slate-600">Use this as the single source of editorial context for SocialFlow.</p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className={`rounded-3xl border px-5 py-4 shadow-sm ${readinessToneClass}`}>
          <div className="text-[11px] font-black uppercase tracking-[0.18em]">Product readiness</div>
          <div className="mt-2 text-lg font-black">{data.summary.readiness.label}</div>
          <p className="mt-2 text-sm leading-6">
            {data.summary.readiness.pilotNotes[0]}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Flow checkpoint</div>
          <div className="mt-2 text-lg font-black text-slate-950">Campaign → Post → Calendar → Publish → Analytics</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This tenant already runs on the canonical product shell, so every step below updates the same shared workspace and product dataset.
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Accounts ready</div>
          <div className="mt-2 text-lg font-black text-slate-950">{connectedAccounts.length}</div>
          <p className="mt-2 text-sm text-slate-600">
            {liveLinkedInAccount
              ? "One LinkedIn account is connected live. Other providers remain explicit demo connections."
              : "Demo connections are explicit, visible, and ready for first-user walkthroughs."}
          </p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Calendar pressure</div>
          <div className="mt-2 text-lg font-black text-slate-950">{data.calendar.upcomingPosts.length}</div>
          <p className="mt-2 text-sm text-slate-600">Upcoming scheduled posts waiting for the publish loop to move them into Published.</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Archived campaigns</div>
          <div className="mt-2 text-lg font-black text-slate-950">{archivedCampaigns.length}</div>
          <p className="mt-2 text-sm text-slate-600">Archived initiatives stay visible for context without cluttering the live operating flow.</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-[1.75rem] border px-6 py-5 shadow-sm ${commercialToneClass}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.22em]">Commercial activation</div>
              <div className="mt-2 text-2xl font-black">{commercialHeadline}</div>
              <p className="mt-2 max-w-3xl text-sm leading-6">
                Billing runs on the canonical workspace subscription path. SocialFlow can now move a qualified pilot into a real commercial step without pretending that every channel capability is already live.
              </p>
            </div>
            <div className="rounded-full border border-current/20 bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em]">
              {workspaceBilling.plan} · {billingStatusLabel}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Current plan</div>
              <div className="mt-1 text-xl font-black">{workspaceBilling.plan}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Billing status</div>
              <div className="mt-1 text-xl font-black">{billingStatusLabel}</div>
            </div>
            <div className="rounded-2xl border border-current/15 bg-white/70 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Current period end</div>
              <div className="mt-1 text-xl font-black">
                {workspaceBilling.currentPeriodEnd ? new Date(workspaceBilling.currentPeriodEnd).toLocaleDateString() : "Not active"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Ready to charge</div>
          <div className="mt-2 text-xl font-black text-slate-950">Use one real billing path, keep the rest honest</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <p>
              {canStartPaidActivation
                ? "This workspace has enough operational proof to move a pilot customer onto a paid plan."
                : isCommerciallyActive
                  ? "This workspace already has an active subscription. Keep the operator loop healthy while live billing is in place."
                  : "Before charging, finish the pilot loop so the customer can see campaigns, posts, calendar, and analytics working together."}
            </p>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">What this proves</div>
              <ul className="mt-3 space-y-2">
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>The billing route is real and canonical for the tenant workspace.</span></li>
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>SocialFlow can move a qualified workspace from pilot to paid without leaving the product.</span></li>
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>Simulated publishing and placeholder analytics remain explicitly marked instead of being sold as live.</span></li>
              </ul>
            </div>
            {!workspaceBilling.stripeConfigured ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                Stripe is not configured in this environment yet. The commercial path is wired correctly, but checkout stays guarded until Stripe credentials are available.
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => void handleStartCheckout("PRO")}
                loading={activeAction === "checkout-PRO"}
                disabled={!workspaceBilling.stripeConfigured || isCommerciallyActive || !canStartPaidActivation}
              >
                {isCommerciallyActive ? "Billing already active" : "Start Pro checkout"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  window.location.href = "/client/settings/billing";
                }}
              >
                Open billing settings
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <Card
          title="Connected Accounts"
          subtitle="Connect, review, and set the primary channel"
          className="xl:col-span-5"
          bodyClassName="space-y-5"
          actions={
            <Button variant="ghost" onClick={() => setAccountForm(createEmptyAccountForm())}>
              Reset
            </Button>
          }
        >
          <div id="accounts" className="space-y-5">
            <form className="grid gap-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4" onSubmit={(event) => void handleAccountSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Connection mode" help="Keep demo mode for walkthroughs. Use LinkedIn live when you want one real channel.">
                  <Select
                    value={accountForm.connectionMode}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        connectionMode: event.target.value as AccountFormState["connectionMode"],
                        provider: event.target.value === "live" ? "LINKEDIN" : current.provider,
                        isPrimary: event.target.value === "live" ? true : current.isPrimary,
                      }))}
                  >
                    <option value="demo">Demo connection</option>
                    <option value="live">LinkedIn live connection</option>
                  </Select>
                </Field>
                {accountForm.connectionMode === "live" ? (
                  <Field label="LinkedIn access token" help="Paste one valid LinkedIn member token to verify the live connection.">
                    <TextInput
                      value={accountForm.accessToken}
                      onChange={(event) => setAccountForm((current) => ({ ...current, accessToken: event.target.value }))}
                      placeholder="AQX..."
                    />
                  </Field>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Provider" help="Demo connections keep the onboarding loop honest while OAuth is still pending.">
                  <Select
                    value={accountForm.provider}
                    disabled={accountForm.connectionMode === "live"}
                    onChange={(event) => setAccountForm((current) => ({ ...current, provider: event.target.value as AccountFormState["provider"] }))}
                  >
                    {DEMO_PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>{formatProvider(provider)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Display name" help="Use the client-facing label operators expect to recognize.">
                  <TextInput
                    value={accountForm.displayName}
                    onChange={(event) => setAccountForm((current) => ({ ...current, displayName: event.target.value }))}
                    placeholder="SocialFlow HQ"
                  />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <Field label="Handle" help="Keep it realistic so the product reads like a live tenant.">
                  <TextInput
                    value={accountForm.handle}
                    onChange={(event) => setAccountForm((current) => ({ ...current, handle: event.target.value }))}
                    placeholder="@socialflowhq"
                  />
                </Field>
                <label className="flex items-center gap-2 self-end rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={accountForm.isPrimary}
                    onChange={(event) => setAccountForm((current) => ({ ...current, isPrimary: event.target.checked }))}
                  />
                  Make primary
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={activeAction === "account-submit"}>
                  {accountForm.connectionMode === "live" ? "Verify live LinkedIn" : "Connect demo account"}
                </Button>
                <Help>
                  {accountForm.connectionMode === "live"
                    ? "This is the one real channel in the product today. Other providers stay explicitly in demo mode."
                    : "The active account list below doubles as the first-user connected-channels proof point."}
                </Help>
              </div>
            </form>

            {data.accounts.length === 0 ? (
              <EmptyState
                title="No connected channels yet"
                subtitle="Connect one demo account to unlock campaigns, post scheduling, and the publishing walkthrough."
              />
            ) : (
              <div className="space-y-3">
                {data.accounts.map((account) => {
                  const tokenStatus = String(account.authMeta?.token_status ?? "active");
                  const isDisconnected = account.status === "DISCONNECTED";
                  const isLive = account.status === "CONNECTED_REAL";
                  const accountError = typeof account.authMeta?.lastErrorMessage === "string" ? account.authMeta.lastErrorMessage : null;
                  return (
                    <div key={account.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-slate-950">{formatProvider(account.provider)}</div>
                            {account.isPrimary ? (
                              <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white">
                                Primary
                              </span>
                            ) : null}
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${getAccountStatusTone(account.status)}`}>
                              {formatAccountStatus(account.status)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm text-slate-600">
                            {account.handle || account.displayName || "Connected account"} · token {tokenStatus}
                          </div>
                          {isLive ? (
                            <div className="text-xs uppercase tracking-[0.18em] text-emerald-700">
                              Live publishing is available for LinkedIn on this workspace.
                            </div>
                          ) : null}
                          {accountError ? (
                            <div className="text-sm text-red-600">{accountError}</div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {!isDisconnected ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={activeAction === `account-primary-${account.id}`}
                              onClick={() => void handlePrimaryAccount(account.id)}
                            >
                              Set primary
                            </Button>
                          ) : null}
                          <Button
                            variant="outline"
                            size="sm"
                            loading={activeAction === `account-disconnect-${account.id}`}
                            onClick={() => void handleDisconnectAccount(account.id)}
                          >
                            {isDisconnected ? "Keep disconnected" : "Disconnect"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Automation Rules"
          subtitle="Make the publish loop understandable and manageable"
          className="xl:col-span-7"
          bodyClassName="space-y-5"
        >
          <div id="rules" className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
            <form className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4" onSubmit={(event) => void handleRuleSubmit(event)}>
              <Field label="Rule name" help="Keep the rule wording operator-friendly.">
                <TextInput
                  value={ruleForm.title}
                  onChange={(event) => setRuleForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Auto-publish when scheduled"
                />
              </Field>
              <Field label="Rule description">
                <TextArea
                  rows={3}
                  value={ruleForm.description}
                  onChange={(event) => setRuleForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Publish scheduled SocialFlow content automatically when due."
                />
              </Field>
              <div className="space-y-2">
                <div className="text-sm text-slate-700">Providers in scope</div>
                <div className="flex flex-wrap gap-2">
                  {DEMO_PROVIDERS.map((provider) => {
                    const active = ruleForm.providers.includes(provider);
                    return (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => toggleRuleProvider(provider)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition ${active ? "border-sky-400 bg-sky-100 text-sky-800" : "border-slate-200 bg-white text-slate-500"}`}
                      >
                        {formatProvider(provider)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={ruleForm.enabled}
                  onChange={(event) => setRuleForm((current) => ({ ...current, enabled: event.target.checked }))}
                />
                Keep this rule active
              </label>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={activeAction === "rule-submit"}>
                  {ruleForm.id ? "Save rule" : "Create auto-publish rule"}
                </Button>
                <Button variant="ghost" type="button" onClick={() => setRuleForm(createEmptyRuleForm())}>
                  Reset
                </Button>
              </div>
            </form>

            <div className="space-y-3">
              {automationRules.length === 0 ? (
                <EmptyState
                  title="Auto-publish is not active yet"
                  subtitle="Create one lightweight rule so scheduled posts can move into Published automatically once they are due."
                />
              ) : (
                automationRules.map((rule) => {
                  const enabled = rule.status !== "DONE" && rule.status !== "DISCARDED";
                  return (
                    <div key={rule.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-slate-950">{rule.title}</div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {enabled ? "Enabled" : "Paused"}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">{formatRuleAction(rule)}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                            Trigger: {String(rule.metadata?.trigger ?? "post.scheduled")} · Action: {String(rule.metadata?.action ?? "publish.placeholder")}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" onClick={() => handleRuleEdit(rule)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            loading={activeAction === `rule-toggle-${rule.id}`}
                            onClick={() => void handleRuleToggle(rule, !enabled)}
                          >
                            {enabled ? "Pause rule" : "Enable rule"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-sky-900">
                <div className="font-semibold">How the publishing loop works</div>
                <p className="mt-2">
                  LinkedIn scheduled live posts can publish for real when they become due and this rule is active. Other providers still move through the deterministic MVP publish check so operators can rehearse the full loop without pretending multichannel live delivery already exists.
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <Card
          title="Campaigns"
          subtitle="Keep campaigns easy to read, edit, and archive"
          className="xl:col-span-5"
          bodyClassName="space-y-5"
          actions={
            <Button variant="ghost" onClick={() => setCampaignForm(createEmptyCampaignForm())}>
              New campaign
            </Button>
          }
        >
          <div id="campaigns" className="space-y-5">
            <form className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4" onSubmit={(event) => void handleCampaignSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Campaign name">
                  <TextInput
                    value={campaignForm.name}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Launch Campaign"
                  />
                </Field>
                <Field label="Status">
                  <Select
                    value={campaignForm.status}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, status: event.target.value as CampaignFormState["status"] }))}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="PAUSED">Paused</option>
                    <option value="FINISHED">Finished</option>
                    <option value="ARCHIVED">Archived</option>
                  </Select>
                </Field>
              </div>
              <Field label="Objective">
                <TextInput
                  value={campaignForm.objective}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, objective: event.target.value }))}
                  placeholder="Drive awareness for the next launch window"
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Target segment">
                  <TextInput
                    value={campaignForm.targetSegment}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, targetSegment: event.target.value }))}
                    placeholder="Early-stage operators"
                  />
                </Field>
                <Field label="Optional budget">
                  <TextInput
                    value={campaignForm.budgetEstimate}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, budgetEstimate: event.target.value }))}
                    placeholder="500"
                    inputMode="numeric"
                  />
                </Field>
              </div>
              <Field label="Notes">
                <TextArea
                  rows={3}
                  value={campaignForm.notes}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Key proof points, launch angle, or handoff notes."
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={activeAction === "campaign-submit"}>
                  {campaignForm.id ? "Save campaign" : "Create campaign"}
                </Button>
                {campaignForm.id ? (
                  <Button variant="outline" type="button" onClick={() => setCampaignForm(createEmptyCampaignForm())}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>

            {data.campaigns.length === 0 ? (
              <EmptyState
                title="No campaigns yet"
                subtitle="Create one campaign before you start scheduling posts so the content calendar stays easy to explain."
              />
            ) : (
              <div className="space-y-3">
                {data.campaigns.map((campaign) => (
                  <div key={campaign.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-semibold text-slate-950">{campaign.name}</div>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${campaign.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : campaign.status === "ARCHIVED" ? "bg-slate-100 text-slate-500" : "bg-sky-100 text-sky-700"}`}>
                            {campaign.status}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600">{campaign.objective}</div>
                        <div className="text-sm text-slate-500">
                          Audience: {campaign.targetSegment} · Budget: {campaign.budgetEstimate == null ? "Not set" : `EUR ${campaign.budgetEstimate}`}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => handleCampaignEdit(campaign)}>
                          Edit
                        </Button>
                        {campaign.status !== "ACTIVE" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={activeAction === `campaign-status-${campaign.id}-ACTIVE`}
                            onClick={() => void handleCampaignStatus(campaign, "ACTIVE")}
                          >
                            Activate
                          </Button>
                        ) : null}
                        {campaign.status !== "ARCHIVED" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={activeAction === `campaign-status-${campaign.id}-ARCHIVED`}
                            onClick={() => void handleCampaignStatus(campaign, "ARCHIVED")}
                          >
                            Archive
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card
          title="Posts and Scheduling"
          subtitle="Create, edit, schedule, and publish from one place"
          className="xl:col-span-7"
          bodyClassName="space-y-5"
        >
          <div id="posts" className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
            <form className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50/80 p-4" onSubmit={(event) => void handlePostSubmit(event)}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Title">
                  <TextInput
                    value={postForm.title}
                    onChange={(event) => setPostForm((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="LinkedIn post title"
                    data-testid="post-title"
                  />
                </Field>
                <Field label="Channel">
                  <Select
                    value={postForm.channelId}
                    onChange={(event) => setPostForm((prev) => ({ ...prev, channelId: event.target.value }))}
                    data-testid="channel-select"
                  >
                    {data.channels.map((channel) => (
                      <option key={channel.id} value={channel.id}>
                        {channel.name}
                      </option>
                    ))}
                  </Select>
                  <Help>Pick which editorial channel this post belongs to.</Help>
                </Field>
              </div>
              <Field label="Campaign">
                <Select
                  value={postForm.campaignId}
                  onChange={(event) => setPostForm((current) => ({ ...current, campaignId: event.target.value }))}
                >
                  <option value="">No campaign</option>
                  {data.campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Provider">
                  <Select value={postForm.provider} disabled onChange={() => undefined}>
                    <option value="LINKEDIN">LinkedIn</option>
                  </Select>
                </Field>

                <Field label="LinkedIn account" help={liveLinkedInAccounts.length === 0 ? "Connect one live LinkedIn account to publish live." : "Required for live publishing."}>
                  <Select
                    value={postForm.accountId}
                    onChange={(event) => setPostForm((prev) => ({ ...prev, accountId: event.target.value }))}
                    disabled={liveLinkedInAccounts.length === 0}
                    data-testid="linkedin-account-select"
                  >
                    <option value="">Select account</option>
                    {liveLinkedInAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.handle || account.displayName || account.id}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Status">
                  <Select
                    value={postForm.status}
                    data-testid="status-select"
                    onChange={(event) =>
                      setPostForm((current) => {
                        const status = event.target.value as PostFormState["status"];
                        return {
                          ...current,
                          status,
                          publicationMode: status === "SCHEDULED" ? current.publicationMode : "demo",
                        };
                      })}
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="SCHEDULED">Scheduled</option>
                  </Select>
                </Field>
              </div>

              <Field
                label="Publishing path"
                help={liveLinkedInAccount
                  ? "LinkedIn scheduled live publishing is available on this workspace."
                  : "Live scheduled publishing requires one connected LinkedIn live account."}
              >
                <Select
                  value={postForm.publicationMode}
                  data-testid="publishing-path-select"
                  disabled={postForm.provider !== "LINKEDIN" || postForm.status !== "SCHEDULED"}
                  onChange={(event) => setPostForm((current) => ({ ...current, publicationMode: event.target.value as PostFormState["publicationMode"] }))}
                >
                  <option value="demo">Demo publishing</option>
                  <option value="live" disabled={!liveLinkedInAccount || postForm.provider !== "LINKEDIN" || postForm.status !== "SCHEDULED"}>
                    LinkedIn live publishing
                  </option>
                </Select>
              </Field>
              <Field label="Body copy">
                <TextArea
                  rows={4}
                  value={postForm.body}
                  onChange={(event) => setPostForm((current) => ({ ...current, body: event.target.value }))}
                  placeholder="SocialFlow is now running on the canonical Drako pipeline."
                />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Scheduled time" help="Calendar and auto-publish only use this value when the post is scheduled.">
                  <TextInput
                    type="datetime-local"
                    value={postForm.scheduledAt}
                    data-testid="post-scheduled-at"
                    onChange={(event) => setPostForm((current) => ({ ...current, scheduledAt: event.target.value }))}
                  />
                </Field>
                <Field label="Optional media hint">
                  <TextInput
                    value={postForm.imageHint}
                    onChange={(event) => setPostForm((current) => ({ ...current, imageHint: event.target.value }))}
                    placeholder="product-demo-dashboard"
                  />
                </Field>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" loading={activeAction === "post-submit"}>
                  {postForm.id ? "Save post" : "Create post"}
                </Button>
                {postForm.id ? (
                  <Button variant="outline" type="button" onClick={() => setPostForm(createEmptyPostForm())}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>

            <div className="space-y-3">
              {recentPosts.length === 0 ? (
                <EmptyState
                  title="No posts in the queue yet"
                  subtitle="Create one scheduled post so operators can see it in the calendar and watch it move into Published."
                />
              ) : (
                recentPosts.map((post) => {
                  const linkedCampaign = data.campaigns.find((campaign) => campaign.id === post.campaignId);
                  const publicationMeta = getPublicationMeta(post);
                  const analyticsMeta = getAnalyticsMeta(post);
                  const postStateLabel = getPostStateLabel(post);
                  const lastAttemptAt = typeof publicationMeta?.lastAttemptAt === "string" ? publicationMeta.lastAttemptAt : null;
                  const externalReference = typeof publicationMeta?.externalPostId === "string"
                    ? publicationMeta.externalPostId
                    : post.externalPostId;
                  const publishError = typeof publicationMeta?.errorMessage === "string" ? publicationMeta.errorMessage : null;
                  const canRefreshLiveAnalytics = post.provider === "LINKEDIN"
                    && Boolean(post.externalPostId)
                    && (post.status === "PUBLISHED" || post.status === "POSTED")
                    && getPublicationMeta(post)?.mode === "live";
                  const canPublishLive = post.provider === "LINKEDIN" && Boolean(liveLinkedInAccount) && post.status !== "PUBLISHED";
                  return (
                    <div
                      id={`post-card-${post.id}`}
                      key={post.id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm transition ${reviewedPostId === post.id ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-100"}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-base font-semibold text-slate-950">{post.title}</div>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${getPostStateTone(post)}`}>
                              {postStateLabel}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600">{post.body}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>{formatProvider(post.provider)}</span>
                            {(() => {
                              const channel = data.channels.find((item) => item.id === post.channelId);
                              return channel ? (
                                <span
                                  data-testid={`post-channel-${post.id}`}
                                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                                >
                                  {channel.name}
                                </span>
                              ) : null;
                            })()}
                            {getPublicationMeta(post)?.accountHandle || getPublicationMeta(post)?.accountId ? (
                              <span
                                data-testid={`post-account-handle-${post.id}`}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                              >
                                {String(getPublicationMeta(post)?.accountHandle ?? getPublicationMeta(post)?.accountId)}
                              </span>
                            ) : null}
                            <span>•</span>
                            <span>{post.status === "PUBLISHED" ? formatDateTime(post.postedAt) : formatDateTime(post.updatedAt)}</span>
                          </div>
                          {linkedCampaign ? <span>{linkedCampaign.name}</span> : null}
                          {externalReference ? (
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              External reference: {externalReference}
                            </div>
                          ) : null}
                          {lastAttemptAt ? (
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Last publish attempt: {formatDateTime(lastAttemptAt)}
                            </div>
                          ) : null}
                          {publishError ? (
                            <div className="text-sm text-red-600">{publishError}</div>
                          ) : null}
                          {analyticsMeta ? (
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                  {formatAnalyticsSource(analyticsMeta.source)}
                                </div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                                  {formatDateTime(analyticsMeta.lastFetchedAt)}
                                </div>
                              </div>
                              <div className={`mt-2 text-xs font-semibold ${getAnalyticsRefreshTone(analyticsMeta)}`}>
                                {analyticsMeta.lastRefreshStatus === "error"
                                  ? analyticsMeta.lastRefreshErrorMessage ?? "Last analytics refresh failed."
                                  : analyticsMeta.source === "live_linkedin"
                                    ? "Last live LinkedIn sync completed successfully."
                                    : "Showing fallback analytics until a live LinkedIn refresh succeeds."}
                              </div>
                              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Last sync</div>
                                  <div className="mt-1 text-xs font-semibold text-slate-800">{formatDateTime(analyticsMeta.lastFetchedAt)}</div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Sync status</div>
                                  <div className={`mt-1 text-xs font-semibold ${getAnalyticsRefreshTone(analyticsMeta)}`}>
                                    {analyticsMeta.lastRefreshStatus === "error" ? "Last refresh failed" : "Last refresh succeeded"}
                                  </div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Analytics source</div>
                                  <div className="mt-1 text-xs font-semibold text-slate-800">{formatAnalyticsSource(analyticsMeta.source)}</div>
                                </div>
                              </div>
                              {analyticsMeta.lastRefreshErrorMessage ? (
                                <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                                  Last error: {analyticsMeta.lastRefreshErrorMessage}
                                  {analyticsMeta.lastRefreshErrorCode ? ` (${analyticsMeta.lastRefreshErrorCode})` : ""}
                                </div>
                              ) : null}
                              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Impressions</div>
                                  <div className="mt-1 text-sm font-black text-slate-950">{analyticsMeta.impressions}</div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Likes</div>
                                  <div className="mt-1 text-sm font-black text-slate-950">{analyticsMeta.likes}</div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Comments</div>
                                  <div className="mt-1 text-sm font-black text-slate-950">{analyticsMeta.comments}</div>
                                </div>
                                <div className="rounded-xl border border-slate-100 bg-white px-3 py-2">
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Shares</div>
                                  <div className="mt-1 text-sm font-black text-slate-950">{analyticsMeta.shares}</div>
                                </div>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" size="sm" data-testid={`post-edit-${post.id}`} onClick={() => handlePostEdit(post)}>
                            Edit
                          </Button>
                          {canPublishLive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={activeAction === `post-publish-live-${post.id}`}
                              onClick={() => void handlePublishLive(post)}
                            >
                              Publish live to LinkedIn
                            </Button>
                          ) : null}
                          {post.status !== "PUBLISHED" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={activeAction === `post-publish-${post.id}`}
                              onClick={() => void handlePublishNow(post)}
                            >
                              {canPublishLive ? "Publish demo now" : "Publish now"}
                            </Button>
                          ) : null}
                          {canRefreshLiveAnalytics ? (
                            <Button
                              variant="outline"
                              size="sm"
                              loading={activeAction === `post-refresh-analytics-${post.id}`}
                              onClick={() => void handleRefreshLiveAnalytics(post)}
                            >
                              Refresh live analytics
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <Card
          title="Calendar"
          subtitle="See what is upcoming and what will leave the queue"
          className="xl:col-span-7"
          bodyClassName="space-y-5"
        >
          <div id="calendar" className="space-y-5">
            {data.calendar.days.length === 0 ? (
              <EmptyState
                title="The calendar is still empty"
                subtitle="Once you schedule a post it appears here immediately, and it disappears from Upcoming after it moves into Published."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.calendar.days.map((day) => (
                  <div key={day.date} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{formatDayLabel(day.date)}</div>
                      <div className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold text-sky-800">
                        {day.posts.length} queued
                      </div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {day.posts.map((post) => (
                        <div key={post.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold text-slate-900">{post.title}</div>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getPostStateTone(post)}`}>
                              {getPostStateLabel(post)}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{formatProvider(post.provider)} · {formatDateTime(post.scheduledAt)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Upcoming queue</div>
                  <div className="mt-1 text-sm text-slate-600">Scheduled posts stay here until the publish loop moves them into Published.</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRunPublishCheck()}
                  loading={activeAction === "publish-check"}
                >
                  Run publish check
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {data.calendar.upcomingPosts.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
                    No upcoming posts remain. Either the queue is empty or due items already moved into Published.
                  </div>
                ) : (
                  data.calendar.upcomingPosts.map((post) => (
                    <div key={post.id} className="rounded-xl border border-slate-100 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">{post.title}</div>
                          <div className="mt-1 text-sm text-slate-600">{formatProvider(post.provider)} · {formatDateTime(post.scheduledAt)}</div>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] ${getPostStateTone(post)}`}>
                          {getPostStateLabel(post)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6 xl:col-span-5">
          <Card title="Analytics" subtitle="Live LinkedIn metrics when available, placeholder metrics for the rest of the MVP" bodyClassName="space-y-5">
            <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-sm ${
              healthySyncNeedsRefresh
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-100 bg-slate-50 text-slate-600"
            }`}>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">LinkedIn live analytics</div>
                <div className="mt-1 font-semibold text-slate-900">
                  {liveLinkedInAccount
                    ? liveAnalyticsRefreshErrors > 0
                      ? "Scheduled live publishing is active, but one or more analytics refreshes need attention."
                      : liveAnalyticsPosts > 0
                        ? "Live scheduled publishing is active for LinkedIn and real engagement metrics are flowing."
                        : "LinkedIn live connection exists, but no eligible live metrics have been synced yet."
                    : "Connect one live LinkedIn account to unlock real post analytics."}
                </div>
                {healthySyncNeedsRefresh ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-amber-800">
                    <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                      Healthy sync is aging
                    </span>
                    <span>Refresh recommended to keep LinkedIn live analytics current.</span>
                  </div>
                ) : null}
              </div>
              <Button
                variant={healthySyncNeedsRefresh ? "primary" : "outline"}
                onClick={() => void handleRefreshWorkspaceLiveAnalytics()}
                loading={activeAction === "workspace-live-analytics-refresh"}
                disabled={!liveLinkedInAccount}
              >
                Refresh LinkedIn live analytics
              </Button>
            </div>
            <div className={`rounded-2xl border px-4 py-4 ${getAnalyticsHealthTone(data.summary.analyticsHealth.status)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em]">LinkedIn live analytics health</div>
                  <div className="mt-2 text-xl font-black">{data.summary.analyticsHealth.status}</div>
                  <div className="mt-2 text-sm leading-6">{data.summary.analyticsHealth.recommendation}</div>
                  {data.summary.analyticsHealth.resolvedRecently ? (
                    <div className="mt-3 inline-flex items-center rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-800">
                      {data.summary.analyticsHealth.resolvedRecentlyCount} recent recover{data.summary.analyticsHealth.resolvedRecentlyCount === 1 ? "y" : "ies"}
                    </div>
                  ) : null}
                </div>
                <div className="rounded-full border border-current/15 bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em]">
                  {data.summary.analyticsHealth.totalEligibleLivePosts} eligible live posts
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-current/10 bg-white/70 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Healthy posts</div>
                  <div className="mt-1 text-xl font-black">{data.summary.analyticsHealth.healthyPosts}</div>
                </div>
                <div className="rounded-2xl border border-current/10 bg-white/70 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Sync issues</div>
                  <div className="mt-1 text-xl font-black">{data.summary.analyticsHealth.failedPosts}</div>
                </div>
                <div className="rounded-2xl border border-current/10 bg-white/70 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">No live data yet</div>
                  <div className="mt-1 text-xl font-black">{data.summary.analyticsHealth.noLiveAnalyticsYetPosts}</div>
                </div>
                <div className="rounded-2xl border border-current/10 bg-white/70 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Last workspace sync</div>
                  <div className="mt-1 text-sm font-black">
                    {data.summary.analyticsHealth.lastWorkspaceSyncAt
                      ? formatDateTime(data.summary.analyticsHealth.lastWorkspaceSyncAt)
                      : "No live sync yet"}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">
                  Last healthy live sync
                </span>
                <span className="font-medium text-slate-900">
                  {data.summary.analyticsHealth.lastHealthyLiveSyncAt
                    ? formatDateTime(data.summary.analyticsHealth.lastHealthyLiveSyncAt)
                    : "No healthy live sync yet"}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getHealthySyncFreshnessTone(data.summary.analyticsHealth.healthySyncFreshnessStatus)}`}>
                  {formatHealthySyncFreshness(data.summary.analyticsHealth.healthySyncFreshnessStatus)}
                </span>
                {data.summary.analyticsHealth.healthySyncNeedsRefresh ? (
                  <span className="text-amber-700">Healthy sync is aging; a manual refresh is recommended.</span>
                ) : null}
              </div>
              {data.summary.analyticsHealth.resolvedRecently ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-sky-200 bg-white/70 px-4 py-3 text-sm text-sky-800">
                  <span className="rounded-full border border-sky-200 bg-sky-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]">
                    Resolved recently
                  </span>
                  <span>
                    {data.summary.analyticsHealth.resolvedRecentlyCount} recent recover{data.summary.analyticsHealth.resolvedRecentlyCount === 1 ? "y" : "ies"} with no active incident left open.
                  </span>
                  <span className="text-sky-700/80">
                    Last recovery: {data.summary.analyticsHealth.lastResolvedAt ? formatDateTime(data.summary.analyticsHealth.lastResolvedAt) : "Not available"}
                  </span>
                </div>
              ) : null}
            </div>
            <div id="analytics" className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Last 7 days</div>
                <div className="mt-3 text-3xl font-black text-slate-950">{data.analytics.last7Days.engagement}</div>
                <div className="mt-2 text-sm text-slate-600">
                  {data.analytics.last7Days.publishedPosts} published posts · {data.analytics.last7Days.impressions} impressions
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Last 30 days</div>
                <div className="mt-3 text-3xl font-black text-slate-950">{data.analytics.last30Days.engagement}</div>
                <div className="mt-2 text-sm text-slate-600">
                  Avg engagement / published post: {data.analytics.last30Days.averageEngagementPerPublishedPost}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Top provider</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {data.analytics.last30Days.topProvider ? formatProvider(data.analytics.last30Days.topProvider) : "No provider yet"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Last live sync health</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">
                  {liveAnalyticsRefreshErrors > 0 ? `${liveAnalyticsRefreshErrors} post${liveAnalyticsRefreshErrors === 1 ? "" : "s"} need attention` : "Healthy"}
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  {data.summary.analyticsHealth.lastHealthyLiveSyncAt
                    ? `Last healthy live sync: ${formatDateTime(data.summary.analyticsHealth.lastHealthyLiveSyncAt)} · ${formatHealthySyncFreshness(data.summary.analyticsHealth.healthySyncFreshnessStatus)}.`
                    : liveAnalyticsPosts > 0
                      ? `${liveAnalyticsPosts} live LinkedIn post${liveAnalyticsPosts === 1 ? "" : "s"} already show real metrics.`
                      : "No live post has synced real metrics yet."}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Operational summary</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>{data.summary.analyticsHealth.healthyPosts} posts healthy</span></li>
                {data.summary.analyticsHealth.failedPosts > 0 ? (
                  <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>{data.summary.analyticsHealth.failedPosts} posts with sync issues</span></li>
                ) : null}
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>Last healthy live sync: {data.summary.analyticsHealth.lastHealthyLiveSyncAt ? formatDateTime(data.summary.analyticsHealth.lastHealthyLiveSyncAt) : "No healthy live sync yet"}</span></li>
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>Healthy sync freshness: {formatHealthySyncFreshness(data.summary.analyticsHealth.healthySyncFreshnessStatus)}</span></li>
                {data.summary.analyticsHealth.resolvedRecently ? (
                  <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>{data.summary.analyticsHealth.resolvedRecentlyCount} recent recover{data.summary.analyticsHealth.resolvedRecentlyCount === 1 ? "y" : "ies"}</span></li>
                ) : null}
                {data.summary.analyticsHealth.lastResolvedAt ? (
                  <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>Last recovery: {formatDateTime(data.summary.analyticsHealth.lastResolvedAt)}</span></li>
                ) : null}
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>Last workspace sync: {data.summary.analyticsHealth.lastWorkspaceSyncAt ? formatDateTime(data.summary.analyticsHealth.lastWorkspaceSyncAt) : "No live sync yet"}</span></li>
                <li className="flex gap-2"><span className="font-black text-sky-600">•</span><span>{data.summary.analyticsHealth.recommendation}</span></li>
              </ul>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Recent sync activity</div>
                    <div className="mt-1 text-sm text-slate-600">Latest LinkedIn live analytics refresh attempts for this workspace.</div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {data.summary.analyticsHealth.recentActivity.length} recent events
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {data.summary.analyticsHealth.recentActivity.length === 0 ? (
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      No recent live analytics sync activity yet.
                    </div>
                  ) : (
                    data.summary.analyticsHealth.recentActivity.map((item) => {
                      const affectedPost = data.posts.find((post) => post.id === item.postId) ?? null;
                      const canRetryActivity = (item.state === "fallback" || item.state === "error") && canRetryAnalyticsPost(affectedPost);
                      return (
                      <div key={`${item.postId}-${item.lastFetchedAt}`} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{item.postTitle}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              {formatProvider(item.provider)} · {formatDateTime(item.lastFetchedAt)}
                            </div>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getSyncActivityTone(item.state as "success" | "fallback" | "error" | "resolved")}`}>
                            {item.summary}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getReviewedTone(!!item.reviewed)}`}>
                            {item.reviewed ? "Reviewed" : "Active"}
                          </span>
                          {item.manualReviewAt ? (
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                              Reviewed {formatDateTime(item.manualReviewAt)}
                            </span>
                          ) : null}
                        </div>
                        {item.state === "resolved" ? (
                          <div className="mt-2 text-sm font-medium text-sky-700">
                            Incident resolved by successful live refresh.
                          </div>
                        ) : null}
                        <div className="mt-3 grid gap-2 sm:grid-cols-3 text-xs text-slate-600">
                          <div>
                            <div className="font-black uppercase tracking-[0.18em] text-slate-400">Source</div>
                            <div className="mt-1 font-semibold text-slate-800">{formatAnalyticsSource(String(item.analyticsSource ?? "placeholder"))}</div>
                          </div>
                          <div>
                            <div className="font-black uppercase tracking-[0.18em] text-slate-400">Sync status</div>
                            <div className="mt-1 font-semibold text-slate-800">
                              {item.state === "resolved"
                                ? "Recovered live"
                                : item.lastRefreshStatus === "error"
                                  ? "Refresh failed"
                                  : "Refresh succeeded"}
                            </div>
                          </div>
                          <div>
                            <div className="font-black uppercase tracking-[0.18em] text-slate-400">External reference</div>
                            <div className="mt-1 break-all font-semibold text-slate-800">{item.externalPostId ?? "Not available"}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-sm text-slate-600">{item.recommendation}</div>
                        {item.manualReviewNote ? (
                          <div className="mt-2 text-sm text-slate-500">Review note: {item.manualReviewNote}</div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {(item.state === "fallback" || item.state === "error") ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!canRetryActivity}
                              loading={activeAction === `post-refresh-analytics-${item.postId}`}
                              onClick={() => {
                                if (!canRetryAnalyticsPost(affectedPost)) return;
                                void handleRefreshLiveAnalytics(affectedPost);
                              }}
                            >
                              Retry analytics refresh
                            </Button>
                          ) : null}
                          {(item.state === "fallback" || item.state === "error") && !item.reviewed ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReviewDraft(item.postId, "activity", item.manualReviewNote)}
                            >
                              Mark as reviewed
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReviewPost(item.postId)}
                          >
                            Review post
                          </Button>
                        </div>
                        {renderReviewComposer(item.postId, "activity")}
                      </div>
                    );
                    })
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Recent incidents</div>
                    <div className="mt-1 text-sm text-slate-600">Posts that still need operator attention before analytics are healthy again.</div>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    {data.summary.analyticsHealth.recentIncidents.length} incidents
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {data.summary.analyticsHealth.recentIncidents.length === 0 ? (
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      Live analytics are healthy; no recent incidents detected.
                    </div>
                  ) : (
                    data.summary.analyticsHealth.recentIncidents.map((item) => {
                      const affectedPost = data.posts.find((post) => post.id === item.postId) ?? null;
                      const canRetryIncident = canRetryAnalyticsPost(affectedPost);
                      return (
                      <div key={`incident-${item.postId}-${item.lastFetchedAt}`} className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-900">{item.postTitle}</div>
                            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                              {item.summary} · {formatDateTime(item.lastFetchedAt)}
                            </div>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getSyncActivityTone(item.state as "success" | "fallback" | "error" | "resolved")}`}>
                            {item.state === "error" ? "Needs attention" : "Fallback active"}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${getReviewedTone(!!item.reviewed)}`}>
                            {item.reviewed ? "Reviewed" : "Active incident"}
                          </span>
                          {item.manualReviewAt ? (
                            <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                              Reviewed {formatDateTime(item.manualReviewAt)}
                            </span>
                          ) : null}
                        </div>
                        {item.lastRefreshErrorMessage ? (
                          <div className="mt-3 text-sm text-red-700">
                            {item.lastRefreshErrorMessage}
                            {item.lastRefreshErrorCode ? ` (${item.lastRefreshErrorCode})` : ""}
                          </div>
                        ) : null}
                        <div className="mt-3 text-sm text-slate-600">{item.recommendation}</div>
                        {item.manualReviewNote ? (
                          <div className="mt-2 text-sm text-slate-500">Review note: {item.manualReviewNote}</div>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canRetryIncident}
                            loading={activeAction === `post-refresh-analytics-${item.postId}`}
                            onClick={() => {
                              if (!canRetryAnalyticsPost(affectedPost)) return;
                              void handleRefreshLiveAnalytics(affectedPost);
                            }}
                          >
                            Retry analytics refresh
                          </Button>
                          {!item.reviewed ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openReviewDraft(item.postId, "incident", item.manualReviewNote)}
                            >
                              Mark as reviewed
                            </Button>
                          ) : null}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReviewPost(item.postId)}
                          >
                            Review post
                          </Button>
                        </div>
                        {renderReviewComposer(item.postId, "incident")}
                      </div>
                    );
                    })
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600">
              {liveAnalyticsPosts > 0
                ? `${liveAnalyticsRefreshErrors > 0 ? "The last LinkedIn live analytics refresh reported issues for part of the live set." : "LinkedIn live posts now refresh real engagement metrics inside this workspace."} ${data.summary.overview.publishedPostsLast30Days - liveAnalyticsPosts > 0 ? "Demo-published posts still fall back to placeholder analytics." : "No placeholder metrics are needed for the current published live set."}`
                : "Analytics still fall back to placeholder engagement signals until one live LinkedIn post is published and refreshed."}
            </div>
          </Card>

          <Card title="Early-user readiness" subtitle="What is ready now versus what still stays simulated" bodyClassName="space-y-4">
            <div className={`rounded-2xl border px-4 py-4 ${readinessToneClass}`}>
              <div className="text-[11px] font-black uppercase tracking-[0.18em]">Status</div>
              <div className="mt-2 text-lg font-black">{data.summary.readiness.label}</div>
              <p className="mt-2 text-sm leading-6">{data.summary.readiness.pilotNotes[0]}</p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Ready now</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {data.summary.readiness.readyNow.map((item: string) => (
                    <li key={item} className="flex gap-2">
                      <span className="font-black text-emerald-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Still simulated</div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                  {data.summary.readiness.simulatedAreas.map((item: string) => (
                    <li key={item} className="flex gap-2">
                      <span className="font-black text-amber-600">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card title="Current MVP Mode" subtitle="Professional transparency for demos and first operators" tone="glass" bodyClassName="space-y-3">
            {data.summary.transparency.map((item: { key: string; label: string; message: string }) => (
              <div key={item.key} className="rounded-2xl border border-sky-100 bg-white/80 p-4">
                <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{item.message}</div>
              </div>
            ))}
          </Card>
        </div>
      </section>
    </div>
  );
}
