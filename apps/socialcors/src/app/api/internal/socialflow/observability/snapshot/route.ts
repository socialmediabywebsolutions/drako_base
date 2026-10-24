import { SOCIALCORS_INTERNAL_CONTRACT_VERSION, type SocialFlowObservabilitySnapshot } from "@/lib/capabilities/internal-api-types/socialflow";
import { env } from "@/lib/cf";
import { getSocialFlowOperatorObservability } from "@/lib/socialflow/contracts/observability";
import { listRecentAgentRuns } from "@/lib/socialflow/internal-api/operator-actions";
import { authenticateInternalRequest, internalError, internalJson } from "@/lib/socialflow/internal-api/respond";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = authenticateInternalRequest(request);
  if (!auth.ok) return auth.response;
  const { requestId, tenantId } = auth.caller;

  const saasId = new URL(request.url).searchParams.get("saasId")?.trim();
  if (!tenantId || !saasId) {
    return internalError(
      "INTERNAL_API_BAD_REQUEST",
      "tenantId (X-Drako-Tenant-Id header) and saasId (query param) are required",
      requestId,
      400,
    );
  }

  // Sin try/catch a propósito: un fallo real de datos debe llegar como 500 al cliente, que
  // lo traduce en un mensaje honesto de "unavailable" — no en un 200 con ceros inventados.
  const db = env()?.SOCIAL_DB;
  const [observability, recentAgentRuns] = await Promise.all([
    getSocialFlowOperatorObservability({ tenantId, saasId }),
    db ? listRecentAgentRuns(db, tenantId).catch(() => []) : Promise.resolve([]),
  ]);

  const response: SocialFlowObservabilitySnapshot = {
    service: "socialflow",
    runtime: "socialcors",
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    requestId,
    warnings: [],
    ...observability,
    recentAgentRuns,
  };

  return internalJson(response);
}
