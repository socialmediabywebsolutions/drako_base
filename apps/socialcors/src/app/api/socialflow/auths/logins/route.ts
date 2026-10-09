export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { enforceSocialFlowAuthBoundary } from "@/lib/socialflow/platform/auth/boundary";
import { isAuthsIsolationEnabled } from "@/lib/socialflow/platform/auth/flags";
import { jsonError, setSocialFlowSessionCookie } from "@/lib/socialflow/platform/auth/http";
import { loginSocialFlowUser } from "@/lib/socialflow/platform/auth/services";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  const boundary = enforceSocialFlowAuthBoundary({ request, endpoint: "/api/socialflow/auths/logins" });
  if (!boundary.ok) return boundary.response;

  const body = (await request.json().catch(() => null)) as LoginBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const login = await loginSocialFlowUser({
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
    saas_slug: "socialflow",
  });
  setSocialFlowSessionCookie({ response, token: login.token });
  return response;
}
