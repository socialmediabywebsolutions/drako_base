export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { DatabaseUnavailableError, respondDatabaseError } from "../../../../../lib/db/runtime-db";
import { jsonError, setSocialFlowSessionCookie } from "../../../../../lib/auth/http";
import { loginSocialFlowAuthUser } from "../../../../../lib/auth/service";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as LoginBody | null;
    if (!body?.email || !body.password) {
      return jsonError("INVALID_INPUT", "Email and password are required.");
    }

    const login = await loginSocialFlowAuthUser({
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
    setSocialFlowSessionCookie({ response, token: login.token, request });
    return response;
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    if (error instanceof DatabaseUnavailableError) {
      return jsonError("SOCIALFLOW_AUTH_DB_UNAVAILABLE", error.message, 503);
    }
    console.error("SOCIALFLOW_RUNTIME_LOGIN_ERROR", error);
    return jsonError("SOCIALFLOW_RUNTIME_LOGIN_FAILED", "Unable to log into SocialFlow.", 500);
  }
}
