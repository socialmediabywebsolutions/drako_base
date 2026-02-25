export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import { createAuthsSessionToken } from "@/lib/auths/tokens";
import { jsonError, setAuthsSessionCookie } from "@/lib/auths/http";
import { isAuthsIsolationEnabled } from "@/lib/auths/flags";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

type LoginBody = {
  email?: string;
  password?: string;
  tenantId?: string;
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  if (resolveAuthsContextFromRequest(request) !== "bases") {
    return jsonError("HOST_CONTEXT_MISMATCH", "Invalid host for bases auth boundary.", 403);
  }

  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const conf = env();
  if (!conf) {
    return jsonError("ENVIRONMENT_NOT_AVAILABLE", "Environment is unavailable.", 500);
  }

  const email = body.email.trim().toLowerCase();
  const adminEmail = conf.ADMIN_EMAIL?.trim().toLowerCase() ?? null;
  const adminPassword = conf.ADMIN_PASSWORD ?? null;
  const userPassword = conf.USER_PASSWORD ?? null;

  let role: "admin" | "user";
  let expectedPassword: string | null;

  if (adminEmail && email === adminEmail) {
    role = "admin";
    expectedPassword = adminPassword ?? userPassword;
  } else {
    role = "user";
    expectedPassword = userPassword ?? adminPassword;
  }

  if (!expectedPassword || body.password !== expectedPassword) {
    return jsonError("INVALID_CREDENTIALS", "Invalid credentials.", 401);
  }

  const tenantId = body.tenantId?.trim() || conf.DEFAULT_TENANT_ID || DEMO_TENANT_ID;
  const token = await createAuthsSessionToken({
    context: "bases",
    sub: `bases:${email}`,
    email,
    tenantId,
    role,
  });

  const response = NextResponse.json({ ok: true, role, tenantId, context: "bases" });
  setAuthsSessionCookie({ response, context: "bases", token });
  return response;
}
