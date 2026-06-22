export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { saveKnowledgeDoc } from "@/lib/socialflow/knowledge/repository";

const USER_AGENT = "SocialFlowKnowledgeBot/1.0 (+https://socialflows.drako.systems)";
const TIMEOUT_MS = 10_000;
const MAX_CONTENT_CHARS = 50_000;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
}

function extractContent(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";

  // Remove scripts, styles, nav, footer, header
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "");

  // Extract paragraphs and headings
  const parts: string[] = [];
  const pattern = /<(?:p|h[1-6]|li|td|th|article|section|main)[^>]*>([\s\S]*?)<\/(?:p|h[1-6]|li|td|th|article|section|main)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(cleaned)) !== null) {
    const text = decodeEntities(stripTags(match[1])).trim();
    if (text.length > 20) parts.push(text);
  }

  const text = parts.join("\n").slice(0, MAX_CONTENT_CHARS) ||
    decodeEntities(stripTags(cleaned)).slice(0, MAX_CONTENT_CHARS);

  return { title, text };
}

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  let body: { url?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const rawUrl = body.url?.trim() ?? "";
  if (!rawUrl) {
    return NextResponse.json({ error: "URL_REQUIRED" }, { status: 400 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).toString();
  } catch {
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let contentText: string;
  let pageTitle: string;
  try {
    const res = await fetch(normalizedUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return NextResponse.json(
        { error: "FETCH_FAILED", message: `HTTP ${res.status} from URL.` },
        { status: 422 },
      );
    }

    const html = await res.text();
    const { title, text } = extractContent(html);
    pageTitle = title;
    contentText = text;

    if (!contentText.trim()) {
      return NextResponse.json(
        { error: "NO_CONTENT", message: "Could not extract readable content from this URL." },
        { status: 422 },
      );
    }
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "FETCH_FAILED", message: msg }, { status: 422 });
  }

  try {
    const name = body.name?.trim() || pageTitle || normalizedUrl;
    const doc = await saveKnowledgeDoc({
      tenantId: session.tenantId,
      saasId: session.saasId,
      name,
      type: "url",
      contentText,
      sourceUrl: normalizedUrl,
    });
    return NextResponse.json({ ok: true, doc: { id: doc.id, name: doc.name, type: doc.type, source_url: doc.source_url, created_at: doc.created_at } });
  } catch (err) {
    console.error("[Knowledge/url] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
