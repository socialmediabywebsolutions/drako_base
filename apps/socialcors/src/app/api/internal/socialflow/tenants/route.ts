import { SOCIALCORS_INTERNAL_CONTRACT_VERSION, type SocialFlowTenantsResponse } from "@/lib/capabilities/internal-api-types/socialflow";
import { env } from "@/lib/cf";
import { authenticateInternalRequest, internalError, internalJson } from "@/lib/socialflow/internal-api/respond";
import { listSocialCorsTenants } from "@/lib/socialflow/internal-api/operator-actions";

export const dynamic = "force-dynamic";

// Todos los tenants de SocialCors para el selector del panel del operator.
export async function GET(request: Request) {
  const auth = authenticateInternalRequest(request);
  if (!auth.ok) return auth.response;

  const db = env()?.SOCIAL_DB;
  if (!db) return internalError("INTERNAL_API_UNAVAILABLE", "SOCIAL_DB binding missing", auth.caller.requestId, 503);

  const response: SocialFlowTenantsResponse = {
    service: "socialflow",
    runtime: "socialcors",
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    requestId: auth.caller.requestId,
    tenants: await listSocialCorsTenants(db),
  };
  return internalJson(response);
}
