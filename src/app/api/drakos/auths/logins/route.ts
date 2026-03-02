export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { drakosAuths } from "@/lib/auths/drakos-auths";
import { jsonError, setAuthsSessionCookie } from "@/lib/auths/http";
import { isAuthsIsolationEnabled } from "@/lib/auths/flags";
import { enforceAuthBoundary, resolveSaasSlugForAuthContext } from "@/lib/auths/ssot";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  const boundary = enforceAuthBoundary({ request, expectedContext: "drakos", endpoint: "/api/drakos/auths/logins" });
  if (!boundary.ok) return boundary.response;
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const login = await drakosAuths.login({
    context: "drakos",
    email: body.email,
    password: body.password,
  });
  if (!login.ok) {
    return jsonError(login.code, login.message, 401);
  }

  const response = NextResponse.json({
    ok: true,
    role: login.role,
    tenantId: login.tenantId,
    saas_slug: resolveSaasSlugForAuthContext("drakos"),
  });
  setAuthsSessionCookie({ response, context: "drakos", token: login.token });
  return response;
}
