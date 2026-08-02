export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { getCurrentSocialFlowSessionFromRequest } from "@/lib/socialflow/auth/request";
import {
  generateNicheAnalysis,
  runNicheIntelligenceCron,
  NICHE_INTELLIGENCE_NICHES,
  type NicheIntelligenceNiche,
} from "@/lib/socialflow/intelligence/NicheIntelligenceCronAgent";

const CORE_TENANT_ID = "socialflow-core";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const session = await getCurrentSocialFlowSessionFromRequest(request).catch(() => null);
  if (session?.tenantId === CORE_TENANT_ID) return true;

  const providedKey = request.headers.get("x-admin-key")?.trim();
  const configuredKey = env()?.SOCIALFLOW_ADMIN_KEY?.trim();
  if (!providedKey || !configuredKey) return false;
  return constantTimeEqual(providedKey, configuredKey);
}

function isValidNiche(value: unknown): value is NicheIntelligenceNiche {
  return typeof value === "string" && (NICHE_INTELLIGENCE_NICHES as readonly string[]).includes(value);
}

// Manual trigger for NicheIntelligenceCronAgent — same work the Monday 03:00 UTC
// cron does, exposed here so it can be tested/forced without waiting a week.
export async function POST(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bindings = env();
  if (!bindings?.SOCIAL_DB) {
    return NextResponse.json({ ok: false, code: "SOCIAL_DB_UNAVAILABLE" }, { status: 503 });
  }

  const body = (await request.json().catch(() => ({}))) as { niche?: unknown };
  const requestedNiche = body?.niche;

  if (requestedNiche !== undefined && !isValidNiche(requestedNiche)) {
    return NextResponse.json(
      { code: "INVALID_NICHE", message: `niche must be one of: ${NICHE_INTELLIGENCE_NICHES.join(", ")}` },
      { status: 400 },
    );
  }

  const startedAt = Date.now();

  if (requestedNiche) {
    await generateNicheAnalysis(requestedNiche, bindings);
    return NextResponse.json({
      success: true,
      niches: [requestedNiche],
      duration_ms: Date.now() - startedAt,
    });
  }

  const results = await runNicheIntelligenceCron(bindings);
  return NextResponse.json({
    success: true,
    niches: results.map((r) => r.niche),
    results,
    duration_ms: Date.now() - startedAt,
  });
}
