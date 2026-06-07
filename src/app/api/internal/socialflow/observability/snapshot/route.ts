import { NextResponse } from "next/server";
import type { SocialFlowObservabilitySnapshot } from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: authResult.status });
  }

  const response: SocialFlowObservabilitySnapshot = {
    service: "socialflow",
    runtime: "monolith",
    timestamp: new Date().toISOString(),
    requestId: authResult.requestId,
    tenantId: authResult.tenantId,
    status: "ok",
    // Stable initial contract: neutral metrics until a decoupled observability source is wired.
    metrics: {
      activeAutomations: 0,
      queuedJobs: 0,
      failedJobsLast24h: 0,
      successfulJobsLast24h: 0,
      averageLatencyMs: null,
    },
    recentErrors: [],
    warnings: ["SOCIALFLOW_OBSERVABILITY_SNAPSHOT_NEUTRAL_VALUES"],
  };

  return NextResponse.json(response, { status: 200 });
}
