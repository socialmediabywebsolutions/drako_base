export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { enforceSocialFlowAuthBoundary } from "@/lib/socialflow/platform/auth/boundary";
import { clearSocialFlowSessionCookie } from "@/lib/socialflow/platform/auth/http";

export async function POST(request: Request) {
  const boundary = enforceSocialFlowAuthBoundary({ request, endpoint: "/api/socialflow/auths/logouts" });
  if (!boundary.ok) return boundary.response;
  const response = NextResponse.json({ ok: true });
  clearSocialFlowSessionCookie({ response });
  return response;
}
