import { saveKnowledgeDoc, upsertKnowledgeDocByTypeAndName, type KnowledgeDoc } from "@/lib/socialflow/knowledge/repository";
import { scrapeUrl } from "@/lib/socialflow/knowledge/scraper";
import { defaultLocalModel } from "@/lib/socialflow/ai/models/localModel";
import type { ChannelCompetitor } from "@/lib/socialflow/profile/types";

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

// Builds a best-effort profile URL from a configured competitor's platform +
// handle (e.g. Mi Perfil → Competidores never stores a generic website, only
// platform/handle) so the analyzer has something to scrape when the user
// hasn't entered a URL manually.
export function buildCompetitorSourceUrl(competitor: ChannelCompetitor): string | null {
  const handle = competitor.handle?.trim().replace(/^@/, "");
  if (!handle) return null;
  switch (competitor.platform) {
    case "instagram":
      return `https://www.instagram.com/${handle}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${handle}`;
    case "linkedin":
      return `https://www.linkedin.com/company/${handle}`;
    case "facebook":
      return `https://www.facebook.com/${handle}`;
    case "x":
      return `https://x.com/${handle}`;
    case "youtube":
      return `https://www.youtube.com/@${handle}`;
    default:
      return null;
  }
}

// Core competitor analysis: scrape (if a URL is available) + AI extraction +
// save as a knowledge doc. Shared by the manual "Analizar competidora" panel
// and by the automatic background analysis triggered on profile save.
export async function analyzeCompetitorForKnowledgeBase(input: {
  tenantId: string;
  saasId: string;
  name?: string | null;
  url?: string | null;
  // true for the automatic path — updates the existing doc for this competitor
  // instead of piling up a new row every time the profile is saved.
  dedupe?: boolean;
  // Extra metadata stored alongside the doc (e.g. { auto_detected: true, source: "discovery" }).
  metadata?: Record<string, unknown> | null;
}): Promise<KnowledgeDoc> {
  const competitorName = input.name?.trim() ?? "";
  const competitorUrl = input.url?.trim() ?? "";
  if (!competitorName && !competitorUrl) {
    throw new Error("NAME_OR_URL_REQUIRED");
  }
  const nameToUse = competitorName || competitorUrl;

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
    { prompt, tenantId: input.tenantId, saasId: input.saasId },
    () => baseReport(nameToUse),
  );

  const contentText = formatReport(nameToUse, resolvedUrl, report);
  const docParams = {
    tenantId: input.tenantId,
    saasId: input.saasId,
    name: `Competitor: ${nameToUse}`,
    type: "competitor" as const,
    contentText,
    sourceUrl: resolvedUrl,
    metadata: input.metadata ?? null,
  };

  return input.dedupe ? upsertKnowledgeDocByTypeAndName(docParams) : saveKnowledgeDoc(docParams);
}
