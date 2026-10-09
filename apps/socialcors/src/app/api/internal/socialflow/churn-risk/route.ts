import { SOCIALCORS_INTERNAL_CONTRACT_VERSION, type SocialFlowChurnRiskResponse } from "@/lib/capabilities/internal-api-types/socialflow";
import { env } from "@/lib/cf";
import { listHighChurnRiskTenants } from "@/lib/socialflow/ai/agents/ChurnPredictionAgent";
import { authenticateInternalRequest, internalError, internalJson } from "@/lib/socialflow/internal-api/respond";

export const dynamic = "force-dynamic";

const DEFAULT_MIN_SCORE = 60;

// Tenants con riesgo de abandono (ChurnPredictionAgent). Señal interna: nunca se muestra al cliente.
export async function GET(request: Request) {
  const auth = authenticateInternalRequest(request);
  if (!auth.ok) return auth.response;

  const runtimeEnv = env();
  if (!runtimeEnv?.SOCIAL_DB) return internalError("INTERNAL_API_UNAVAILABLE", "SOCIAL_DB binding missing", auth.caller.requestId, 503);

  const parsed = Number.parseInt(new URL(request.url).searchParams.get("minScore") ?? "", 10);
  const minScore = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 100) : DEFAULT_MIN_SCORE;

  const tenants = await listHighChurnRiskTenants(runtimeEnv, minScore);
  const response: SocialFlowChurnRiskResponse = {
    service: "socialflow",
    runtime: "socialcors",
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    requestId: auth.caller.requestId,
    minScore,
    tenants: tenants as unknown as SocialFlowChurnRiskResponse["tenants"],
  };
  return internalJson(response);
}
