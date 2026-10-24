import {
  SOCIALCORS_INTERNAL_CONTRACT_VERSION,
  type SocialFlowAutomationTriggerRequest,
  type SocialFlowAutomationTriggerResponse,
  type SocialFlowAutomationType,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { authenticateInternalRequest, internalError, internalJson, readNonEmptyString } from "@/lib/socialflow/internal-api/respond";
import { checkTenantConnections, queueOperatorCampaign } from "@/lib/socialflow/internal-api/operator-actions";

export const dynamic = "force-dynamic";

const ALLOWED_AUTOMATION_TYPES = new Set<SocialFlowAutomationType>([
  "publish_due_posts",
  "sync_profiles",
  "refresh_metrics",
  "validate_connections",
  "generate_schedule",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateAutomationTriggerBody(body: unknown): body is SocialFlowAutomationTriggerRequest {
  if (!isRecord(body)) {
    return false;
  }

  if (
    typeof body.automationType !== "string"
    || !ALLOWED_AUTOMATION_TYPES.has(body.automationType as SocialFlowAutomationType)
  ) {
    return false;
  }

  if (body.source !== "campobase" && body.source !== "system") {
    return false;
  }

  if (body.tenantId !== null && typeof body.tenantId !== "string") {
    return false;
  }

  if (body.correlationId !== null && typeof body.correlationId !== "string") {
    return false;
  }

  if (body.requestedBy !== null && typeof body.requestedBy !== "string") {
    return false;
  }

  if (!isRecord(body.payload)) {
    return false;
  }

  return true;
}

const DEFAULT_SAAS_ID = "socialflow";

export async function POST(request: Request) {
  const auth = authenticateInternalRequest(request);
  if (!auth.ok) return auth.response;
  const { requestId } = auth.caller;

  const body = await request.json().catch(() => null);
  if (!body) {
    return internalError("INTERNAL_API_BAD_REQUEST", "Invalid JSON body", requestId, 400);
  }
  if (!validateAutomationTriggerBody(body)) {
    return internalError("INTERNAL_API_BAD_REQUEST", "Invalid automation trigger payload", requestId, 400);
  }

  const tenantId = body.tenantId ?? auth.caller.tenantId;
  const saasId = readNonEmptyString(body.payload.saasId) ?? DEFAULT_SAAS_ID;
  const base = {
    service: "socialflow" as const,
    runtime: "socialcors" as const,
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    accepted: true as const,
    automationId: crypto.randomUUID(),
    automationType: body.automationType,
    requestId,
    tenantId,
    timestamp: new Date().toISOString(),
  };

  if (body.automationType === "generate_schedule") {
    const niche = readNonEmptyString(body.payload.niche);
    if (!tenantId || !niche) {
      return internalError("INTERNAL_API_BAD_REQUEST", "tenantId and payload.niche are required", requestId, 400);
    }
    const frequency = Number(body.payload.frequencyPerWeek);
    const { campaignId } = await queueOperatorCampaign({
      tenantId,
      saasId,
      niche,
      tone: readNonEmptyString(body.payload.tone),
      frequencyPerWeek: Number.isFinite(frequency) && frequency > 0 ? Math.min(Math.floor(frequency), 14) : 1,
    });
    // La generación es asíncrona (Worker IA): campaña creada y job encolado.
    const response: SocialFlowAutomationTriggerResponse = { ...base, automationId: campaignId, status: "queued", result: { campaignId } };
    return internalJson(response, 202);
  }

  if (body.automationType === "validate_connections") {
    if (!tenantId) {
      return internalError("INTERNAL_API_BAD_REQUEST", "tenantId is required", requestId, 400);
    }
    const result = await checkTenantConnections({ tenantId, saasId });
    const response: SocialFlowAutomationTriggerResponse = { ...base, status: "completed", result };
    return internalJson(response, 200);
  }

  // publish_due_posts / sync_profiles / refresh_metrics los ejecutan los crons propios de
  // SocialCors; el contrato no los expone (antes respondía "queued" sin hacer nada).
  return internalError(
    "INTERNAL_API_NOT_SUPPORTED",
    `automationType ${body.automationType} is run by SocialCors crons and cannot be triggered remotely`,
    requestId,
    422,
  );
}
