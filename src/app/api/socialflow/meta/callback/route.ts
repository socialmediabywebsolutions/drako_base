import { NextResponse } from "next/server";
import {
  handleSocialFlowMetaCallback,
  resolveSocialFlowMetaCallbackSession,
} from "@/lib/socialflow/meta/oauth";

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
  const session = await resolveSocialFlowMetaCallbackSession(request);
  const result = await handleSocialFlowMetaCallback(request, session);

  if (!result.ok) {
    const url = buildCallbackRedirect(request, result.redirectTo, {
      meta: "error",
      provider: "meta",
      code: result.error.code,
      message: result.error.message,
      saasId: result.saasId,
    });
    return NextResponse.redirect(url, 308);
  }

  const url = buildCallbackRedirect(request, result.redirectTo, {
    meta: result.persistence.status === "failed" ? "warning" : "connected",
    provider: "meta",
    status: result.persistence.status,
    saasId: result.saasId,
    accountIds: "accountIds" in result.persistence ? result.persistence.accountIds.join(",") : null,
  });
  return NextResponse.redirect(url, 308);
}
