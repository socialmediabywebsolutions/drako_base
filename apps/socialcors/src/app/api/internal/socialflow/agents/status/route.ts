import { SOCIALCORS_INTERNAL_CONTRACT_VERSION, type SocialFlowAgentsStatusResponse } from "@/lib/capabilities/internal-api-types/socialflow";
import { authenticateInternalRequest, internalJson } from "@/lib/socialflow/internal-api/respond";
import { getSocialCorsAgentControlCenter } from "@/lib/socialflow/internal-api/agent-control-center";

export const dynamic = "force-dynamic";

// Centro de control de agentes del Cerebro (estado, última ejecución, contenido real).
export async function GET(request: Request) {
  const auth = authenticateInternalRequest(request);
  if (!auth.ok) return auth.response;

  const response: SocialFlowAgentsStatusResponse = {
    service: "socialflow",
    runtime: "socialcors",
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    requestId: auth.caller.requestId,
    groups: await getSocialCorsAgentControlCenter(),
  };
  return internalJson(response);
}
