import { NextResponse } from "next/server";
import { getSocialFlowCookieConfig } from "./cookies";

export function jsonError(code: string, message: string, status = 400) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function setSocialFlowSessionCookie(params: {
  response: NextResponse;
  token: string;
  request?: Request;
}) {
  const config = getSocialFlowCookieConfig(params.request);
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

export function clearSocialFlowSessionCookie(params: {
  response: NextResponse;
  request?: Request;
}) {
  const config = getSocialFlowCookieConfig(params.request);
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
