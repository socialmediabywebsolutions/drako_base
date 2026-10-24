export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { saveKnowledgeDoc } from "@/lib/socialflow/knowledge/repository";
import { scrapeUrl } from "@/lib/socialflow/knowledge/scraper";

const DEFAULT_SAAS_ID = "socialflow";

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
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

  const scraped = await scrapeUrl(rawUrl);
  if (!scraped.ok) {
    const status = scraped.error === "INVALID_URL" ? 400 : 422;
    return NextResponse.json({ error: scraped.error }, { status });
  }

  try {
    const name = body.name?.trim() || scraped.title || scraped.url;
    const doc = await saveKnowledgeDoc({
      tenantId: session.tenantId,
      saasId: resolveSaasId(req),
      name,
      type: "url",
      contentText: scraped.text,
      sourceUrl: scraped.url,
    });
    return NextResponse.json({ ok: true, doc: { id: doc.id, name: doc.name, type: doc.type, source_url: doc.source_url, created_at: doc.created_at } });
  } catch (err) {
    console.error("[Knowledge/url] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
