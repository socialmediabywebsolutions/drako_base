const USER_AGENT = "SocialFlowKnowledgeBot/1.0 (+https://socialflows.drako.systems)";
const TIMEOUT_MS = 10_000;
export const MAX_SCRAPE_CHARS = 50_000;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function extractHtmlContent(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "");

  const parts: string[] = [];
  const pattern = /<(?:p|h[1-6]|li|td|th|article|section|main)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|li|td|th|article|section|main)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cleaned)) !== null) {
    const text = decodeEntities(stripTags(match[1])).trim();
    if (text.length > 20) parts.push(text);
  }

  const text =
    parts.join("\n").slice(0, MAX_SCRAPE_CHARS) ||
    decodeEntities(stripTags(cleaned)).slice(0, MAX_SCRAPE_CHARS);

  return { title, text };
}

export async function scrapeUrl(
  rawUrl: string,
): Promise<{ ok: true; url: string; title: string; text: string } | { ok: false; error: string }> {
  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(
      /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`,
    ).toString();
  } catch {
    return { ok: false, error: "INVALID_URL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(normalizedUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, error: `HTTP_${res.status}` };
    }

    const html = await res.text();
    const { title, text } = extractHtmlContent(html);
    if (!text.trim()) return { ok: false, error: "NO_CONTENT" };
    return { ok: true, url: normalizedUrl, title, text };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
