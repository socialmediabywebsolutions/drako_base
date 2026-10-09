export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { handleThreadsCallback } from "@/lib/socialflow/threads/oauth";

function buildCallbackRedirect(request: NextRequest, targetPath: string, params: Record<string, string | null | undefined>) {
  const url = new URL(targetPath, request.url);
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

export async function GET(request: NextRequest) {
  const result = await handleThreadsCallback(request);

  if (!result.ok) {
    const url = buildCallbackRedirect(request, result.redirectTo, {
      threads: "error",
      provider: "threads",
      code: result.error.code,
      message: result.error.message,
      saasId: result.saasId ?? undefined,
    });
    return NextResponse.redirect(url, 308);
  }

  const url = buildCallbackRedirect(request, result.redirectTo, {
    threads: "connected",
    provider: "threads",
    saasId: result.saasId,
    accountId: result.accountId,
  });
  return NextResponse.redirect(url, 308);
}
