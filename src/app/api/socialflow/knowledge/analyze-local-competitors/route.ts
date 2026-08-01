export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { CompetitorIntelligenceAgent } from "@/lib/socialflow/ai/agents/CompetitorIntelligenceAgent";
import type { CompetitorIntelligenceResult } from "@/lib/socialflow/ai/types";
import { upsertKnowledgeDocByType } from "@/lib/socialflow/knowledge/repository";

const DEFAULT_SAAS_ID = "socialflow";
const DEFAULT_RADIUS_KM = 5;

function resolveSaasId(request: Request): string {
  return new URL(request.url).searchParams.get("saasId")?.trim() || DEFAULT_SAAS_ID;
}

function resolveRadiusKm(request: Request): number {
  const raw = new URL(request.url).searchParams.get("radiusKm");
  if (!raw) return DEFAULT_RADIUS_KM;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_RADIUS_KM;
}

const KNOWN_AGENT_ERRORS = new Set([
  "EMPRESA_LOCAL_NOT_CONFIGURED",
  "GOOGLE_MAPS_API_KEY_NOT_CONFIGURED",
  "GEOCODING_FAILED",
]);

export async function POST(req: Request) {
  let session: Awaited<ReturnType<typeof requireCurrentSocialFlowSession>>;
  try {
    session = await requireCurrentSocialFlowSession(req);
  } catch {
    return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
  }

  const saasId = resolveSaasId(req);
  const radiusKm = resolveRadiusKm(req);

  let result: CompetitorIntelligenceResult;
  try {
    result = await new CompetitorIntelligenceAgent().run({ tenantId: session.tenantId, saasId, radiusKm });
  } catch (err) {
    const code = err instanceof Error ? err.message : String(err);
    if (KNOWN_AGENT_ERRORS.has(code)) {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    console.error("[Knowledge/analyze-local-competitors] agent run failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "ANALYZE_LOCAL_COMPETITORS_FAILED" }, { status: 500 });
  }

  try {
    const doc = await upsertKnowledgeDocByType({
      tenantId: session.tenantId,
      saasId,
      name: "Análisis de competencia local",
      type: "market_analysis",
      contentText: result.report,
      sourceUrl: null,
    });
    return NextResponse.json({
      ok: true,
      doc: { id: doc.id, name: doc.name, type: doc.type, source_url: doc.source_url, created_at: doc.created_at },
      competitors: result.competitors,
      geocodedAt: result.geocodedAt,
    });
  } catch (err) {
    console.error("[Knowledge/analyze-local-competitors] save failed", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "ANALYZE_LOCAL_COMPETITORS_FAILED" }, { status: 500 });
  }
}
