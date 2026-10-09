import { NextResponse } from "next/server";
import {
  type SocialFlowEventRequest,
  type SocialFlowEventResponse,
  type SocialFlowEventType,
} from "@/lib/capabilities/internal-api-types/socialflow";
import { validateInternalServiceTokenRequest } from "@/lib/capabilities/internal-api-auth/service-token";

export const dynamic = "force-dynamic";

const ALLOWED_EVENT_TYPES = new Set<SocialFlowEventType>([
  "socialflow.automation.requested",
  "socialflow.automation.started",
  "socialflow.automation.completed",
  "socialflow.automation.failed",
  "socialflow.health.degraded",
  "socialflow.owner.snapshot.requested",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateEventRequestBody(body: unknown): body is SocialFlowEventRequest {
  if (!isRecord(body)) {
    return false;
  }

  if (typeof body.eventType !== "string" || !ALLOWED_EVENT_TYPES.has(body.eventType as SocialFlowEventType)) {
    return false;
  }

  if (body.source !== "campobase" && body.source !== "owner" && body.source !== "system") {
    return false;
  }

  if (typeof body.occurredAt !== "string" || Number.isNaN(Date.parse(body.occurredAt))) {
    return false;
  }

  if (body.tenantId !== null && typeof body.tenantId !== "string") {
    return false;
  }

  if (body.correlationId !== null && typeof body.correlationId !== "string") {
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

  if (!validateEventRequestBody(body)) {
    return buildBadRequestResponse(authResult.requestId, "Invalid event payload");
  }

  const eventId = crypto.randomUUID();
  const response: SocialFlowEventResponse = {
    service: "socialflow",
    runtime: "monolith",
    accepted: true,
    eventId,
    eventType: body.eventType,
    requestId: authResult.requestId,
    tenantId: body.tenantId ?? authResult.tenantId,
    timestamp: new Date().toISOString(),
  };

  // Stable initial contract: real event persistence will be wired in a later decoupling phase.
  return NextResponse.json(response, { status: 202 });
}
