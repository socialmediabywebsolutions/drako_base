import { requireCurrentSocialFlowSession } from "@/lib/socialflow/auth/request";
import { getSocialInsightsSnapshot, resolveSocialContext, SocialContextError } from "@/lib/socialflow/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await requireCurrentSocialFlowSession(request);
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId")?.trim() || "socialflow";

    const ctx = await resolveSocialContext({ tenantId: session.tenantId, saasId });
    const insights = await getSocialInsightsSnapshot(ctx);

    return new Response(JSON.stringify({ ok: true, insights }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return new Response(JSON.stringify({ error: "SESSION_REQUIRED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    if (error instanceof SocialContextError) {
      return new Response(JSON.stringify({ error: "SOCIAL_CONTEXT_UNAVAILABLE" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    console.error("SOCIALFLOW_INSIGHTS_ERROR", error instanceof Error ? error.message : "unknown");
    return new Response(JSON.stringify({ error: "INSIGHTS_FAILED" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
