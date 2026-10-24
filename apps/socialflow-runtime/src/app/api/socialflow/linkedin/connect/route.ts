import { requireCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { addRuntimeHeaders, getRuntimeCorrelationId, logRuntimeEvent } from "../../../../../lib/runtime-observability";
import { buildRuntimeLinkedInConnectUrl } from "../../../../../lib/socialflow/linkedin-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  try {
    const { searchParams } = new URL(request.url);
    const saasId = searchParams.get("saasId")?.trim() || "";
    const redirectTo = searchParams.get("redirectTo")?.trim() || null;

    if (!saasId) {
      return addRuntimeHeaders(new Response(JSON.stringify({ error: "saasId is required" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      }), { request, correlationId });
    }

    const session = await requireCurrentSocialFlowSession(request);
    const oauth = await buildRuntimeLinkedInConnectUrl({
      request,
      tenantId: session.tenantId,
      saasId,
      redirectTo,
    });

    return addRuntimeHeaders(new Response(null, {
      status: 307,
      headers: { location: oauth.authorizationUrl },
    }), { request, correlationId });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      logRuntimeEvent("warn", "linkedin_connect_session_required", { correlationId });
      return addRuntimeHeaders(new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }), { request, correlationId });
    }

    logRuntimeEvent("error", "linkedin_connect_failed", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return addRuntimeHeaders(new Response(JSON.stringify({ error: "LINKEDIN_CONNECT_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    }), { request, correlationId });
  }
}
