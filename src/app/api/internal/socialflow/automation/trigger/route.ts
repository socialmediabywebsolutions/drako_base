import { NextResponse } from "next/server";
import {
  type SocialFlowAutomationTriggerRequest,
  type SocialFlowAutomationTriggerResponse,
  type SocialFlowAutomationType,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

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

function buildBadRequestResponse(requestId: string, message: string) {
  return NextResponse.json(
    {
      code: "INTERNAL_API_BAD_REQUEST",
      message,
      requestId,
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  const authResult = validateInternalServiceTokenRequest(request);

  if (!authResult.ok) {
    return NextResponse.json(authResult.error, { status: authResult.status });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return buildBadRequestResponse(authResult.requestId, "Invalid JSON body");
  }

  if (!validateAutomationTriggerBody(body)) {
    return buildBadRequestResponse(authResult.requestId, "Invalid automation trigger payload");
  }

  const response: SocialFlowAutomationTriggerResponse = {
    service: "socialflow",
    runtime: "monolith",
    accepted: true,
    automationId: crypto.randomUUID(),
    automationType: body.automationType,
    requestId: authResult.requestId,
    tenantId: body.tenantId ?? authResult.tenantId,
    timestamp: new Date().toISOString(),
    status: "queued",
  };

  // Stable initial contract: real automation execution wiring will be connected in a later phase.
  return NextResponse.json(response, { status: 202 });
}
