export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { DatabaseUnavailableError, respondDatabaseError } from "../../../../../lib/db/runtime-db";
import { jsonError, setSocialFlowSessionCookie } from "../../../../../lib/auth/http";
import { loginSocialFlowAuthUser } from "../../../../../lib/auth/service";
import { addRuntimeHeaders, getRuntimeCorrelationId, logRuntimeEvent } from "../../../../../lib/runtime-observability";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  try {
    const body = (await request.json().catch(() => null)) as LoginBody | null;
    if (!body?.email || !body.password) {
      logRuntimeEvent("warn", "auth_login_invalid_input", { correlationId });
      return jsonError("INVALID_INPUT", "Email and password are required.", 400, request);
    }

    const login = await loginSocialFlowAuthUser({
      email: body.email,
      password: body.password,
    });
    if (!login.ok) {
      logRuntimeEvent("warn", "auth_login_denied", { correlationId, code: login.code });
      return jsonError(login.code, login.message, 401, request);
    }

    const response = addRuntimeHeaders(NextResponse.json({
      ok: true,
      role: login.role,
      tenantId: login.tenantId,
      saas_slug: "socialflow",
    }), { request, correlationId });
    setSocialFlowSessionCookie({ response, token: login.token, request });
    return response;
  } catch (error) {
    const dbError = respondDatabaseError(error, request);
    if (dbError) return dbError;
    if (error instanceof DatabaseUnavailableError) {
      return jsonError("SOCIALFLOW_AUTH_DB_UNAVAILABLE", error.message, 503, request);
    }
    logRuntimeEvent("error", "auth_login_failed", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError("SOCIALFLOW_RUNTIME_LOGIN_FAILED", "Unable to log into SocialFlow.", 500, request);
  }
}
