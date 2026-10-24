import {
  SOCIALCORS_INTERNAL_CONTRACT_VERSION,
  type SocialFlowOperatorActionResponse,
  type SocialFlowOperatorActionResult,
  type SocialFlowOperatorActionType,
} from "@/lib/capabilities/internal-api-types/socialflow";
import {
  authenticateInternalRequest,
  internalError,
  internalJson,
  isRecord,
  readNonEmptyString,
} from "@/lib/socialflow/internal-api/respond";
import {
  launchOperatorCampaign,
  runPostRecoveryAction,
  testOperatorAiReply,
} from "@/lib/socialflow/internal-api/operator-actions";

export const dynamic = "force-dynamic";

const DEFAULT_SAAS_ID = "socialflow";
const MAX_LAUNCH_TENANTS = 50;

type ParsedAction =
  | { actionType: "recover_stale_publishing" | "retry_failed_posts"; tenantId: string; saasId: string }
  | { actionType: "launch_campaign"; tenants: string[]; saasId: string; title: string; scheduledAt: string | null }
  | {
      actionType: "test_ai_reply";
      tenantId: string;
      saasId: string;
      message: string;
      threadType: "DM" | "COMMENT";
      provider: string;
      niche?: string;
    };

// Validación estricta: tipo de acción conocido y payload con los campos exactos que
// necesita cada acción. Cualquier otra cosa es 400.
function parseAction(body: unknown, callerTenantId: string | null): ParsedAction | string {
  if (!isRecord(body)) return "Body must be a JSON object";
  if (!isRecord(body.payload)) return "payload must be an object";
  const payload = body.payload;
  const actionType = body.actionType as SocialFlowOperatorActionType;
  const tenantId = readNonEmptyString(body.tenantId) ?? callerTenantId;
  const saasId = readNonEmptyString(payload.saasId) ?? DEFAULT_SAAS_ID;

  if (actionType === "recover_stale_publishing" || actionType === "retry_failed_posts") {
    if (!tenantId) return "tenantId is required";
    return { actionType, tenantId, saasId };
  }

  if (actionType === "launch_campaign") {
    const tenants = Array.isArray(payload.tenants)
      ? payload.tenants.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    const title = readNonEmptyString(payload.title);
    if (tenants.length === 0) return "payload.tenants must be a non-empty array of tenant ids";
    if (tenants.length > MAX_LAUNCH_TENANTS) return `payload.tenants accepts at most ${MAX_LAUNCH_TENANTS} tenants`;
    if (!title) return "payload.title is required";
    const scheduledAt = readNonEmptyString(payload.scheduledAt);
    if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) return "payload.scheduledAt must be an ISO date";
    return { actionType, tenants, saasId, title, scheduledAt };
  }

  if (actionType === "test_ai_reply") {
    const message = readNonEmptyString(payload.message);
    if (!tenantId) return "tenantId is required";
    if (!message) return "payload.message is required";
    return {
      actionType,
      tenantId,
      saasId,
      message,
      threadType: payload.threadType === "COMMENT" ? "COMMENT" : "DM",
      provider: readNonEmptyString(payload.provider) ?? "INSTAGRAM",
      niche: readNonEmptyString(payload.niche) ?? undefined,
    };
  }

  return "Unknown actionType";
}

async function execute(action: ParsedAction): Promise<SocialFlowOperatorActionResult> {
  switch (action.actionType) {
    case "recover_stale_publishing":
    case "retry_failed_posts":
      return runPostRecoveryAction({ action: action.actionType, tenantId: action.tenantId, saasId: action.saasId });
    case "launch_campaign":
      return launchOperatorCampaign(action);
    case "test_ai_reply":
      return testOperatorAiReply(action);
  }
}

export async function POST(request: Request) {
  const auth = authenticateInternalRequest(request);
  if (!auth.ok) return auth.response;
  const { requestId, tenantId: callerTenantId } = auth.caller;

  const body = await request.json().catch(() => null);
  const action = parseAction(body, callerTenantId);
  if (typeof action === "string") {
    return internalError("INTERNAL_API_BAD_REQUEST", action, requestId, 400);
  }

  const result = await execute(action);
  const response: SocialFlowOperatorActionResponse = {
    service: "socialflow",
    runtime: "socialcors",
    contractVersion: SOCIALCORS_INTERNAL_CONTRACT_VERSION,
    accepted: true,
    actionId: crypto.randomUUID(),
    actionType: action.actionType,
    requestId,
    tenantId: "tenantId" in action ? action.tenantId : null,
    timestamp: new Date().toISOString(),
    status: "completed",
    result,
  };

  return internalJson(response, 200);
}
