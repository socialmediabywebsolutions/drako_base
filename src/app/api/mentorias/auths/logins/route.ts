export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { mentoriasAuths } from "@/lib/auths/mentorias-auths";
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

  const boundary = enforceAuthBoundary({ request, expectedContext: "mentorias", endpoint: "/api/mentorias/auths/logins" });
  if (!boundary.ok) return boundary.response;
  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const login = await mentoriasAuths.login({
    context: "mentorias",
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
    saas_slug: resolveSaasSlugForAuthContext("mentorias"),
  });
  setAuthsSessionCookie({ response, context: "mentorias", token: login.token });
  return response;
}
