export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { OPERATOR_SESSION_COOKIE } from "@/lib/drako/operator-session";

// POST /api/operator-logout — borra la cookie drako_operator_session.
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(OPERATOR_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
