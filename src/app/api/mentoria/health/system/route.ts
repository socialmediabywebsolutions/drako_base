export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { getMentoriaOrchestrator } from "@/lib/mentoria/resilience/orchestrator";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const orchestrator = getMentoriaOrchestrator();
    const health = await orchestrator.getHealthStatus(actor.tenantId);

    return NextResponse.json({
      ok: true,
      tenantId: actor.tenantId,
      generatedAt: new Date().toISOString(),
      health,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MENTORIA_SYSTEM_HEALTH_FAILED";
    const status = message === "SESSION_REQUIRED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
