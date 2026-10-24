export type WebsiteScrapeResult = {
  url: string;
  title: string;
  description: string;
  keywords: string[];
  headings: string[];
  fetchedAt: string;
  ok: boolean;
  error?: string;
};

const SCRAPE_USER_AGENT = "SocialFlowOnboardingBot/1.0 (+https://socialflow.drako.systems)";
const SCRAPE_TIMEOUT_MS = 8000;

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeEntities(match[1]).trim();
  }
  return null;
}

function extractFromHtml(html: string): Pick<WebsiteScrapeResult, "title" | "description" | "keywords" | "headings"> {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  const description =
    extractMeta(html, "description") || extractMeta(html, "og:description") || extractMeta(html, "twitter:description") || "";

  const keywordsRaw = extractMeta(html, "keywords");
  const keywords = keywordsRaw
    ? keywordsRaw
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean)
    : [];

  const headings: string[] = [];
  const headingPattern = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(html)) && headings.length < 10) {
    const text = decodeEntities(match[1].replace(/<[^>]+>/g, " "))
      .replace(/\s+/g, " ")
      .trim();
    if (text) headings.push(text);
  }

  return { title, description, keywords, headings };
}

// Best-effort, dependency-free HTML scrape used to seed the onboarding wizard.
// Always returns ok:false instead of throwing so callers can persist a partial brand profile.
export async function scrapeWebsite(rawUrl: string): Promise<WebsiteScrapeResult> {
  const fetchedAt = new Date().toISOString();
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return { url: rawUrl, title: "", description: "", keywords: [], headings: [], fetchedAt, ok: false, error: "INVALID_URL" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": SCRAPE_USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      return { url, title: "", description: "", keywords: [], headings: [], fetchedAt, ok: false, error: `HTTP_${response.status}` };
    }

    const html = await response.text();
    return { url, ...extractFromHtml(html), fetchedAt, ok: true };
  } catch (error) {
    return {
      url,
      title: "",
      description: "",
      keywords: [],
      headings: [],
      fetchedAt,
      ok: false,
      error: error instanceof Error ? error.message : "FETCH_FAILED",
    };
  } finally {
    clearTimeout(timeout);
  }
}
