import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  SESSION_COOKIE_MAX_AGE,
  SESSION_COOKIE_NAME,
  createSessionValue,
  type SessionRole,
} from "@/lib/auth/session";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";
// export const runtime = "edge"; // OpenNext Migration


type LoginBody = {
  email?: string;
  password?: string;
  tenantId?: string;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function unauthorized() {
  return jsonError("INVALID_CREDENTIALS", 401);
}

export async function POST(req: Request) {
  const blocked = await enforcePublicEndpointPolicy({ request: req, route: "/api/auth/login" });
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return jsonError("EMAIL_AND_PASSWORD_REQUIRED", 400);
  }

  const email = body.email.trim().toLowerCase();
  const conf = env();
  if (!conf) {
    return jsonError("ENVIRONMENT_NOT_AVAILABLE", 500);
  }

  const adminEmail = conf.ADMIN_EMAIL?.trim().toLowerCase() ?? null;
  const adminPassword = conf.ADMIN_PASSWORD ?? null;
  const userPassword = conf.USER_PASSWORD ?? null;

  let role: SessionRole | null = null;
  let expectedPassword: string | null = null;

  if (adminEmail && email === adminEmail) {
    role = "admin";
    expectedPassword = adminPassword ?? userPassword;
  } else {
    role = "user";
    expectedPassword = userPassword ?? adminPassword;
  }

  if (!expectedPassword || body.password !== expectedPassword) {
    return unauthorized();
  }

  const tenantId = body.tenantId?.trim() || conf.DEFAULT_TENANT_ID || DEMO_TENANT_ID;
  const sessionValue = await createSessionValue({ email, tenantId, role });

  const response = NextResponse.json({ ok: true, role, tenantId });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionValue,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE,
  });

  return response;
}
