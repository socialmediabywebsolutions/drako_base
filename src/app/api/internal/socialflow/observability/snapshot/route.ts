import { NextResponse } from "next/server";
import type { SocialFlowObservabilitySnapshot } from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";
import { getSocialFlowOperatorObservability } from "@/lib/socialflow/contracts/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: authResult.status });
  }

  const url = new URL(request.url);
  const saasId = url.searchParams.get("saasId")?.trim();
  const tenantId = authResult.tenantId;

  if (!tenantId || !saasId) {
    return NextResponse.json(
      {
        code: "INTERNAL_API_BAD_REQUEST",
        message: "tenantId (X-Drako-Tenant-Id header) and saasId (query param) are required",
        requestId: authResult.requestId,
      },
      { status: 400 },
    );
  }

  // Sin try/catch a propósito: un fallo real de datos (SOCIAL_DB no configurado, etc.)
  // debe llegar como 500 real al cliente, que ya lo traduce en un mensaje honesto de
  // "unavailable" — no en un 200 falso con ceros inventados.
  const observability = await getSocialFlowOperatorObservability({ tenantId, saasId });

  const response: SocialFlowObservabilitySnapshot = {
    service: "socialflow",
    runtime: "monolith",
    requestId: authResult.requestId,
    warnings: [],
    ...observability,
  };

  return NextResponse.json(response, { status: 200 });
}
