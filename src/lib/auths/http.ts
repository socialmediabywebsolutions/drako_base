import { NextResponse } from "next/server";
import { getAuthsCookieConfig } from "@/lib/auths/cookies";
import type { AuthsContext } from "@/lib/auths/types";

export function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function setAuthsSessionCookie(params: {
  response: NextResponse;
  context: AuthsContext;
  token: string;
}) {
  const config = getAuthsCookieConfig(params.context);
  params.response.cookies.set({
    name: config.cookieName,
    value: params.token,
    httpOnly: config.httpOnly,
    secure: config.secure,
    sameSite: config.sameSite,
    path: config.cookiePath,
    maxAge: config.maxAgeSeconds,
  });
}

export function clearAuthsSessionCookie(params: {
  response: NextResponse;
  context: AuthsContext;
}) {
  const config = getAuthsCookieConfig(params.context);
  params.response.cookies.set({
    name: config.cookieName,
    value: "",
    httpOnly: config.httpOnly,
    secure: config.secure,
    sameSite: config.sameSite,
    path: config.cookiePath,
    maxAge: 0,
  });
}
