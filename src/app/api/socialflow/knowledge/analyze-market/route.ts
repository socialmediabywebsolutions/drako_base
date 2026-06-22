export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { saveKnowledgeDoc } from "@/lib/socialflow/knowledge/repository";
import { getChannelKnowledge } from "@/lib/socialflow/profile/repository";
import { defaultLocalModel } from "@/lib/socialflow/ai/models/localModel";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

type MarketReport = {
  summary: string;
  trendingHashtags: string[];
  viralKeywords: string[];
  topContentFormats: string[];
  marketOpportunities: string[];
  competitorPatterns: string[];
  seasonalTrends: string[];
};

function baseReport(niche: string): MarketReport {
  return {
    summary: `Market intelligence for the ${niche} sector.`,
    trendingHashtags: [`#${niche.replace(/\s+/g, "").toLowerCase()}`, `#${niche.replace(/\s+/g, "").toLowerCase()}tips`],
    viralKeywords: [`${niche} results`, `${niche} transformation`, `${niche} strategy`],
    topContentFormats: ["Carousel with step-by-step tips", "Before/after reels", "Educational short-form video", "Client testimonials", "Behind-the-scenes content"],
    marketOpportunities: ["Educational content gap", "Personal branding angle", "Community building", "Results-focused storytelling"],
    competitorPatterns: ["Generic motivational content", "Over-polished corporate tone", "Infrequent posting", "Lack of educational depth"],
    seasonalTrends: ["New year planning (January)", "Mid-year review (June)", "Q4 push (October-November)"],
  };
}

function formatReport(niche: string, report: MarketReport): string {
  const lines: string[] = [
    `MARKET ANALYSIS: ${niche.toUpperCase()}`,
    `GENERATED: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `SUMMARY: ${report.summary}`,
    "",
    "TRENDING HASHTAGS:",
    report.trendingHashtags.join(" "),
    "",
    "VIRAL KEYWORD OPPORTUNITIES:",
    ...report.viralKeywords.map((k) => `- ${k}`),
    "",
    "TOP CONTENT FORMATS IN THIS NICHE:",
    ...report.topContentFormats.map((f) => `- ${f}`),
    "",
    "MARKET GAPS & OPPORTUNITIES:",
    ...report.marketOpportunities.map((o) => `- ${o}`),
    "",
    "COMMON COMPETITOR PATTERNS TO DIFFERENTIATE FROM:",
    ...report.competitorPatterns.map((p) => `- ${p}`),
    "",
    "SEASONAL TRENDS & TIMING:",
    ...report.seasonalTrends.map((t) => `- ${t}`),
  ];
  return lines.join("\n").trim();
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const saasId = resolveSaasId(req);

  // Load niche and brand context from the tenant's profile
  let niche = "marketing";
  let audience = "businesses";
  let brandName = "your brand";
  let services: string[] = [];
  let keywords: string[] = [];

  try {
    const { profile } = await getChannelKnowledge(session.tenantId, saasId);
    niche = profile.niche || niche;
    audience = profile.audienceDescription || audience;
    brandName = profile.brandName || brandName;
    services = profile.services.slice(0, 5);
    keywords = profile.baseKeywords.slice(0, 10);
  } catch {
    // Continue with defaults if profile not found
  }

  const prompt = `You are a social media market intelligence analyst with deep expertise in content strategy and trend analysis.

Conduct a comprehensive market analysis for a brand operating in this niche:

Niche: ${niche}
Brand: ${brandName}
Target audience: ${audience}
${services.length ? `Services: ${services.join(", ")}` : ""}
${keywords.length ? `Current keywords: ${keywords.join(", ")}` : ""}

Generate a detailed market intelligence report:

- summary: 3-4 sentence overview of the current state of this niche on social media
- trendingHashtags: 15 hashtags currently trending in this niche (with # prefix, ordered by potential reach)
- viralKeywords: 10 specific keyword phrases with high engagement/viral potential in this sector
- topContentFormats: 5 content formats that consistently perform best in this niche (with brief reason why)
- marketOpportunities: 5 specific content or positioning gaps that represent untapped opportunities
- competitorPatterns: 5 common patterns/mistakes competitors make that this brand can differentiate from
- seasonalTrends: 5 seasonal moments or timing patterns relevant to this niche (with specific months)`;

  const { data: report } = await defaultLocalModel.generateStructured<MarketReport>(
    { prompt, tenantId: session.tenantId, saasId },
    () => baseReport(niche),
  );

  const contentText = formatReport(niche, report);

  try {
    const doc = await saveKnowledgeDoc({
      tenantId: session.tenantId,
      saasId,
      name: `Market Analysis: ${niche}`,
      type: "market_analysis",
      contentText,
      sourceUrl: null,
    });
    return NextResponse.json({
      ok: true,
      doc: { id: doc.id, name: doc.name, type: doc.type, source_url: doc.source_url, created_at: doc.created_at },
    });
  } catch (err) {
    console.error("[Knowledge/analyze-market] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
