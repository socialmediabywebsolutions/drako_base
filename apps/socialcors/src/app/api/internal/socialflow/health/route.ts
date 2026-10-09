import { NextResponse } from "next/server";
import {
  SOCIALCORS_CONTRACT_VERSION_HEADER,
  SOCIALCORS_INTERNAL_CONTRACT_VERSION,
  type SocialFlowHealthResponse,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";
import { env } from "@/lib/cf";
import { aggregateHealthStatus, buildSocialCorsHealthChecks } from "@/lib/socialflow/internal-api/health";

export const dynamic = "force-dynamic";

function resolveServiceVersion(): string {
  return process.env.SOCIALFLOW_INTERNAL_VERSION || process.env.npm_package_version || "0.0.0";
}

export async function GET(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult.error, {
      status: authResult.status,
      headers: { [SOCIALCORS_CONTRACT_VERSION_HEADER]: SOCIALCORS_INTERNAL_CONTRACT_VERSION },
    });
  }

  const checks = await buildSocialCorsHealthChecks(env());
  const status = aggregateHealthStatus(checks);

  const response: SocialFlowHealthResponse = {
    service: "socialflow",
    status,
    runtime: "socialcors",
    version: resolveServiceVersion(),
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    timestamp: new Date().toISOString(),
    requestId: authResult.requestId,
    checks,
  };

  // 200 aunque esté degradado: el cuerpo dice el estado; 503 solo si no puede servir.
  return NextResponse.json(response, {
    status: status === "down" ? 503 : 200,
    headers: { [SOCIALCORS_CONTRACT_VERSION_HEADER]: SOCIALCORS_INTERNAL_CONTRACT_VERSION },
  });
}
