import { NextResponse } from "next/server";
import {
  type SocialFlowOperatorActionRequest,
  type SocialFlowOperatorActionResponse,
  type SocialFlowOperatorActionType,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

export const dynamic = "force-dynamic";

const ALLOWED_ACTION_TYPES = new Set<SocialFlowOperatorActionType>([
  "pause_automation",
  "resume_automation",
  "force_health_check",
  "refresh_connection_status",
  "request_diagnostics",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateOperatorActionBody(body: unknown): body is SocialFlowOperatorActionRequest {
  if (!isRecord(body)) {
    return false;
  }

  if (typeof body.actionType !== "string" || !ALLOWED_ACTION_TYPES.has(body.actionType as SocialFlowOperatorActionType)) {
    return false;
  }

  if (body.source !== "campobase" && body.source !== "owner" && body.source !== "system") {
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

  if (body.reason !== null && typeof body.reason !== "string") {
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

  if (!validateOperatorActionBody(body)) {
    return buildBadRequestResponse(authResult.requestId, "Invalid operator action payload");
  }

  const response: SocialFlowOperatorActionResponse = {
    service: "socialflow",
    runtime: "monolith",
    accepted: true,
    actionId: crypto.randomUUID(),
    actionType: body.actionType,
    requestId: authResult.requestId,
    tenantId: body.tenantId ?? authResult.tenantId,
    timestamp: new Date().toISOString(),
    status: "queued",
  };

  // Stable initial contract: real operator action execution wiring will be connected in a later phase.
  return NextResponse.json(response, { status: 202 });
}
