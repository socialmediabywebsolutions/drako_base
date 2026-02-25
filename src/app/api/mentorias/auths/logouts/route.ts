export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearAuthsSessionCookie } from "@/lib/auths/http";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

export async function POST(request: Request) {
  if (resolveAuthsContextFromRequest(request) !== "mentorias") {
    return NextResponse.json({ ok: false, code: "HOST_CONTEXT_MISMATCH" }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true });
  clearAuthsSessionCookie({ response, context: "mentorias" });
  return response;
}
