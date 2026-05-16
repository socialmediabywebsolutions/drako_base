export const dynamic = "force-dynamic";

import { getSocialFlowRuntimeReadinessReport } from "../../../../../lib/runtime-readiness";
import { logRuntimeEvent, runtimeJson } from "../../../../../lib/runtime-observability";

export async function GET(request: Request) {
  const report = getSocialFlowRuntimeReadinessReport();
  const status = report.ok ? 200 : 503;

  if (!report.ok) {
    logRuntimeEvent("warn", "readiness_blocked", {
      correlationId: request.headers.get("x-correlation-id") ?? null,
      blockers: report.blockers,
    });
  }

  return runtimeJson(report, { status }, { request });
}
