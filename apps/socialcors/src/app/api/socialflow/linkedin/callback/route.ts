import { NextResponse } from "next/server";
import {
  handleSocialFlowLinkedInCallback,
  resolveSocialFlowLinkedInCallbackSession,
} from "@/lib/socialflow/linkedin/oauth";

export const dynamic = "force-dynamic";

function buildCallbackRedirect(request: Request, targetPath: string, params: Record<string, string | null | undefined>) {
  const url = new URL(targetPath, request.url);
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export async function GET(request: Request) {
  const session = await resolveSocialFlowLinkedInCallbackSession(request);
  const result = await handleSocialFlowLinkedInCallback(request, session);

  if (!result.ok) {
    const url = buildCallbackRedirect(request, result.redirectTo, {
      linkedin: "error",
      provider: "linkedin",
      code: result.error.code,
      message: result.error.message,
      saasId: result.saasId,
    });
    return NextResponse.redirect(url, 308);
  }

  const url = buildCallbackRedirect(request, result.redirectTo, {
    linkedin: result.persistence.status === "failed" ? "warning" : "connected",
    provider: "linkedin",
    status: result.persistence.status,
    saasId: result.saasId,
    accountId: "accountId" in result.persistence ? result.persistence.accountId : null,
  });
  return NextResponse.redirect(url, 308);
}
