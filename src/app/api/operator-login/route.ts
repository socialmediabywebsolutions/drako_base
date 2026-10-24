export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { verifyOperatorCredentials } from "@/lib/drako/operator-auth";
import { OPERATOR_SESSION_COOKIE, OPERATOR_SESSION_MAX_AGE, signOperatorSession } from "@/lib/drako/operator-session";

// POST /api/operator-login — body { email, password }. Si son las credenciales del
// operator, setea la cookie httpOnly drako_operator_session (7 días).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!verifyOperatorCredentials(email, password)) {
    return NextResponse.json({ ok: false, error: "Credenciales incorrectas" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signOperatorSession(email.trim().toLowerCase());
  } catch (error) {
    console.error("OPERATOR_LOGIN_SIGN_FAILED", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ ok: false, error: "Sesión no disponible" }, { status: 503 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(OPERATOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OPERATOR_SESSION_MAX_AGE,
  });
  return response;
}
