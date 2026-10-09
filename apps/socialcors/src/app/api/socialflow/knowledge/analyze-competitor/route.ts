export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { analyzeCompetitorForKnowledgeBase } from "@/lib/socialflow/knowledge/competitor-analysis";

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

  let body: { name?: string; url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!body.name?.trim() && !body.url?.trim()) {
    return NextResponse.json({ error: "NAME_OR_URL_REQUIRED" }, { status: 400 });
  }

  try {
    const doc = await analyzeCompetitorForKnowledgeBase({
      tenantId: session.tenantId,
      saasId: resolveSaasId(req),
      name: body.name,
      url: body.url,
      // Clicking "Analizar" again on the same competitor (e.g. from the
      // pre-loaded profile list) updates its existing report instead of
      // creating a duplicate entry every time.
      dedupe: true,
    });
    return NextResponse.json({
      ok: true,
      doc: { id: doc.id, name: doc.name, type: doc.type, source_url: doc.source_url, created_at: doc.created_at },
    });
  } catch (err) {
    console.error("[Knowledge/analyze-competitor] failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "SAVE_FAILED" }, { status: 500 });
  }
}
