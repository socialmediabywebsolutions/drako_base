export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearSocialFlowSessionCookie } from "../../../../../lib/auth/http";
import { addRuntimeHeaders, getRuntimeCorrelationId } from "../../../../../lib/runtime-observability";

export async function POST(request: Request) {
  const response = addRuntimeHeaders(NextResponse.json({ ok: true }), {
    request,
    correlationId: getRuntimeCorrelationId(request),
  });
  clearSocialFlowSessionCookie({ response, request });
  return response;
}
