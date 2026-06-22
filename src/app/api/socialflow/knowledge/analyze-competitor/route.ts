export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { saveKnowledgeDoc } from "@/lib/socialflow/knowledge/repository";
import { scrapeUrl } from "@/lib/socialflow/knowledge/scraper";
import { defaultLocalModel } from "@/lib/socialflow/ai/models/localModel";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

type CompetitorReport = {
  overview: string;
  mainServices: string[];
  keyStrengths: string[];
  targetAudience: string;
  contentPatterns: string[];
  likelyHashtags: string[];
  differentiationOpportunities: string[];
  messagingHooks: string[];
};

function baseReport(name: string): CompetitorReport {
  return {
    overview: `${name} is a competitor operating in the same market segment.`,
    mainServices: ["Core service offering"],
    keyStrengths: ["Market presence", "Brand recognition"],
    targetAudience: "Similar target audience",
    contentPatterns: ["Educational content", "Social proof", "Behind the scenes"],
    likelyHashtags: [`#${name.replace(/\s+/g, "").toLowerCase()}`],
    differentiationOpportunities: ["Personalization", "Better pricing", "Faster results"],
    messagingHooks: ["Results-focused messaging", "Trust-building content"],
  };
}

function formatReport(name: string, url: string | null, report: CompetitorReport): string {
  const lines: string[] = [
    `COMPETITOR: ${name}`,
    url ? `SOURCE: ${url}` : "",
    "",
    `OVERVIEW: ${report.overview}`,
    "",
    "MAIN SERVICES:",
    ...report.mainServices.map((s) => `- ${s}`),
    "",
    "KEY STRENGTHS:",
    ...report.keyStrengths.map((s) => `- ${s}`),
    "",
    `TARGET AUDIENCE: ${report.targetAudience}`,
    "",
    "CONTENT PATTERNS:",
    ...report.contentPatterns.map((p) => `- ${p}`),
    "",
    "LIKELY HASHTAGS:",
    report.likelyHashtags.join(" "),
    "",
    "DIFFERENTIATION OPPORTUNITIES (exploit these gaps):",
    ...report.differentiationOpportunities.map((o) => `- ${o}`),
    "",
    "MESSAGING HOOKS THAT WORK FOR THEM:",
    ...report.messagingHooks.map((h) => `- ${h}`),
  ];
  return lines.filter((l) => l !== undefined).join("\n").trim();
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  let body: { name?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const competitorName = body.name?.trim() ?? "";
  const competitorUrl = body.url?.trim() ?? "";

  if (!competitorName && !competitorUrl) {
    return NextResponse.json({ error: "NAME_OR_URL_REQUIRED" }, { status: 400 });
  }

  const saasId = resolveSaasId(req);
  const nameToUse = competitorName || competitorUrl;

  // Scrape web content if URL provided
  let webContent = "";
  let resolvedUrl: string | null = null;
  if (competitorUrl) {
    const scraped = await scrapeUrl(competitorUrl);
    if (scraped.ok) {
      webContent = scraped.text.slice(0, 6000);
      resolvedUrl = scraped.url;
    }
  }

  const prompt = `You are a competitive intelligence analyst specializing in social media and digital marketing.

Analyze this competitor and extract actionable competitive intelligence to help a brand differentiate itself.

Competitor name: ${nameToUse}
${webContent ? `Website content:\n${webContent}` : "No website content available — infer from industry knowledge."}

Extract:
- overview: 2-3 sentence summary of who they are and their positioning
- mainServices: list of their main services or products (3-6 items)
- keyStrengths: their key differentiators and strengths (3-5 items)
- targetAudience: who they sell to (1-2 sentences)
- contentPatterns: content topics and formats they likely use on social media (4-6 items)
- likelyHashtags: hashtags they likely use (8-12 hashtags with # prefix)
- differentiationOpportunities: specific gaps or weaknesses our client can exploit (3-5 items)
- messagingHooks: effective message angles they use that we should be aware of (3-4 items)`;

  const { data: report } = await defaultLocalModel.generateStructured<CompetitorReport>(
    { prompt, tenantId: session.tenantId, saasId },
    () => baseReport(nameToUse),
  );

  const contentText = formatReport(nameToUse, resolvedUrl, report);

  try {
    const doc = await saveKnowledgeDoc({
      tenantId: session.tenantId,
      saasId,
      name: `Competitor: ${nameToUse}`,
      type: "competitor",
      contentText,
      sourceUrl: resolvedUrl,
    });
    return NextResponse.json({
      ok: true,
      doc: { id: doc.id, name: doc.name, type: doc.type, source_url: doc.source_url, created_at: doc.created_at },
    });
  } catch (err) {
    console.error("[Knowledge/analyze-competitor] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
