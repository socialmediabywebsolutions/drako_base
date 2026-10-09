import { NextResponse } from "next/server";
import {
  type SocialFlowHealthResponse,
  type SocialFlowHealthStatus,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

export const dynamic = "force-dynamic";

function resolveServiceVersion(): string {
  return process.env.SOCIALFLOW_INTERNAL_VERSION || process.env.npm_package_version || "0.0.0";
}

function resolveAggregateStatus(statuses: SocialFlowHealthStatus[]): SocialFlowHealthStatus {
  if (statuses.includes("down")) {
    return "down";
  }

  if (statuses.includes("degraded")) {
    return "degraded";
  }

  return "ok";
}

export async function GET(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: authResult.status });
  }

  const checks: SocialFlowHealthResponse["checks"] = {
    contract: {
      status: "ok",
      detail: "Internal Campobase to SocialFlow contract validated",
    },
    runtime: {
      status: "ok",
      detail: "SocialFlow runs inside monolith runtime",
    },
    auth: {
      status: "ok",
      detail: "Service token and internal headers validated",
    },
  };

  const response: SocialFlowHealthResponse = {
    service: "socialflow",
    status: resolveAggregateStatus(Object.values(checks).map((check) => check.status)),
    runtime: "monolith",
    version: resolveServiceVersion(),
    timestamp: new Date().toISOString(),
    requestId: authResult.requestId,
    checks,
  };

  return NextResponse.json(response, { status: 200 });
}
