export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearAuthsSessionCookie } from "@/lib/auths/http";
import { enforceAuthBoundary } from "@/lib/auths/ssot";

export async function POST(request: Request) {
  const boundary = enforceAuthBoundary({ request, expectedContext: "drakos", endpoint: "/api/drakos/auths/logouts" });
  if (!boundary.ok) return boundary.response;
  const response = NextResponse.json({ ok: true });
  clearAuthsSessionCookie({ response, context: "drakos" });
  return response;
}
