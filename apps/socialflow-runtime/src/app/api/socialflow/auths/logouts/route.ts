export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { clearSocialFlowSessionCookie } from "../../../../../lib/auth/http";

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  clearSocialFlowSessionCookie({ response, request });
  return response;
}
