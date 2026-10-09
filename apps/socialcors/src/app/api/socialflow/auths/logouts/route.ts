export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearAuthsSessionCookie } from "@/lib/auths/http";
import { enforceAuthBoundary } from "@/lib/auths/ssot";

export async function POST(request: Request) {
  const boundary = enforceAuthBoundary({ request, expectedContext: "socialflow", endpoint: "/api/socialflow/auths/logouts" });
  if (!boundary.ok) return boundary.response;
  const response = NextResponse.json({ ok: true });
  clearAuthsSessionCookie({ response, context: "socialflow" });
  return response;
}
