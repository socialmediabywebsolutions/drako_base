export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearSocialFlowSessionCookie } from "../../../../../lib/auth/http";
import { addRuntimeHeaders, getRuntimeCorrelationId, logRuntimeEvent } from "../../../../../lib/runtime-observability";

export async function POST(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  logRuntimeEvent("log", "auth_logout_requested", { correlationId });
  const response = addRuntimeHeaders(NextResponse.json({ ok: true }), {
    request,
    correlationId,
  });
  clearSocialFlowSessionCookie({ response, request });
  return response;
}
