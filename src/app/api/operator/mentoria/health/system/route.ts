export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getMentoriaOrchestrator } from "@/lib/mentoria/resilience/orchestrator";

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const orchestrator = getMentoriaOrchestrator();
    const health = await orchestrator.getHealthStatus(tenantId);

    return NextResponse.json({ ok: true, tenantId, generatedAt: new Date().toISOString(), health });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "MENTORIA_SYSTEM_HEALTH_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
