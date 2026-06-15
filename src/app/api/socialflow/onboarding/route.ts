export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getChannelKnowledge, upsertChannelCompetitor, upsertChannelProfile } from "@/lib/socialflow/profile/repository";
import type { ChannelCompetitor } from "@/lib/socialflow/profile/types";
import { scrapeWebsite } from "@/lib/socialflow/onboarding/scraper";
import { SocialContextError } from "@/lib/socialflow/repository";

const DEFAULT_SAAS_ID = "socialflow";
const MIN_COMPETITORS = 3;
const COMPETITOR_PLATFORMS: ChannelCompetitor["platform"][] = ["instagram", "tiktok", "linkedin", "facebook", "youtube", "x", "other"];

type OnboardingCompetitorInput = {
  name?: unknown;
  handle?: unknown;
  platform?: unknown;
};

type OnboardingRequestBody = {
  saasId?: string | null;
  brandName?: unknown;
  websiteUrl?: unknown;
  niche?: unknown;
  toneOfVoice?: unknown;
  audienceDescription?: unknown;
  activeSocialNetworks?: unknown;
  competitors?: unknown;
};

function resolveSaasId(request: Request, body?: OnboardingRequestBody | null): string {
  const requestUrl = new URL(request.url);
  const querySaasId = requestUrl.searchParams.get("saasId")?.trim();
  const bodySaasId = body?.saasId?.trim();
  return querySaasId || bodySaasId || DEFAULT_SAAS_ID;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function normalizePlatform(value: unknown): ChannelCompetitor["platform"] {
  const normalized = normalizeString(value).toLowerCase();
  return (COMPETITOR_PLATFORMS as string[]).includes(normalized) ? (normalized as ChannelCompetitor["platform"]) : "other";
}

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const saasId = resolveSaasId(request);
    const snapshot = await getChannelKnowledge(session.tenantId, saasId);

    return NextResponse.json({
      ok: true,
      profile: snapshot.profile,
      competitors: snapshot.competitors,
      completed: Boolean(snapshot.profile.onboardingCompletedAt),
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_ONBOARDING_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to load onboarding status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const body = (await request.json().catch(() => null)) as OnboardingRequestBody | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const saasId = resolveSaasId(request, body);
    const brandName = normalizeString(body.brandName);
    const niche = normalizeString(body.niche);
    const websiteUrl = normalizeString(body.websiteUrl);
    const toneOfVoice = normalizeString(body.toneOfVoice);
    const audienceDescription = normalizeString(body.audienceDescription);
    const activeSocialNetworks = normalizeStringArray(body.activeSocialNetworks);
    const competitorsInput = Array.isArray(body.competitors) ? (body.competitors as OnboardingCompetitorInput[]) : [];
    const competitors = competitorsInput
      .map((item) => ({ name: normalizeString(item?.name), handle: normalizeString(item?.handle), platform: normalizePlatform(item?.platform) }))
      .filter((item) => item.name.length > 0);

    if (!brandName || !niche) {
      return NextResponse.json({ ok: false, error: "MISSING_REQUIRED_FIELDS", message: "brandName and niche are required." }, { status: 400 });
    }
    if (competitors.length < MIN_COMPETITORS) {
      return NextResponse.json(
        { ok: false, error: "NOT_ENOUGH_COMPETITORS", message: `Add at least ${MIN_COMPETITORS} competitors.` },
        { status: 400 },
      );
    }

    const scrape = websiteUrl ? await scrapeWebsite(websiteUrl) : null;
    const current = await getChannelKnowledge(session.tenantId, saasId);

    const scrapedKeywords = scrape?.ok ? scrape.keywords : [];
    const scrapedTopics = scrape?.ok ? scrape.headings.slice(0, 8) : [];
    const scrapedDescription = scrape?.ok ? scrape.description || scrape.title : "";

    const profilePatch = {
      brandName,
      websiteUrl,
      niche,
      toneOfVoice: toneOfVoice || current.profile.toneOfVoice,
      audienceDescription: audienceDescription || current.profile.audienceDescription,
      activeSocialNetworks,
      shortDescription: current.profile.shortDescription || scrapedDescription,
      baseKeywords: current.profile.baseKeywords.length > 0 ? current.profile.baseKeywords : scrapedKeywords,
      mainTopics: current.profile.mainTopics.length > 0 ? current.profile.mainTopics : scrapedTopics,
      onboardingCompletedAt: new Date().toISOString(),
    };

    const profile = await upsertChannelProfile(session.tenantId, profilePatch, saasId);

    for (const competitor of competitors) {
      await upsertChannelCompetitor(session.tenantId, { name: competitor.name, handle: competitor.handle || null, platform: competitor.platform }, saasId);
    }

    const finalSnapshot = await getChannelKnowledge(session.tenantId, saasId);

    return NextResponse.json({
      ok: true,
      profile,
      competitors: finalSnapshot.competitors,
      scrape: scrape ? { ok: scrape.ok, url: scrape.url, error: scrape.error ?? null } : null,
    });
  } catch (error) {
    if (error instanceof SocialContextError) {
      return NextResponse.json({ ok: false, error: "INVALID_SOCIAL_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return NextResponse.json({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 });
    }
    console.error("SOCIALFLOW_ONBOARDING_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Failed to save onboarding" }, { status: 500 });
  }
}
