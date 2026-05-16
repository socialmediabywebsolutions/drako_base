export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { respondDatabaseError } from "../../../../../lib/db/runtime-db";
import { jsonError, setSocialFlowSessionCookie } from "../../../../../lib/auth/http";
import { loginSocialFlowAuthUser, registerSocialFlowAuthUser } from "../../../../../lib/auth/service";
import { addRuntimeHeaders, getRuntimeCorrelationId, logRuntimeEvent } from "../../../../../lib/runtime-observability";

type RegistrationBody = {
  email?: string;
  password?: string;
  name?: string;
  tenantId?: string;
};

export async function POST(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  try {
    const body = (await request.json().catch(() => null)) as RegistrationBody | null;
    if (!body?.email || !body.password) {
      logRuntimeEvent("warn", "auth_registration_invalid_input", { correlationId });
      return jsonError("INVALID_INPUT", "Email and password are required.", 400, request);
    }

    const registration = await registerSocialFlowAuthUser({
      email: body.email,
      password: body.password,
      name: body.name ?? null,
      tenantId: body.tenantId ?? null,
    });
    if (!registration.ok) {
      logRuntimeEvent("warn", "auth_registration_denied", { correlationId, code: registration.code });
      return jsonError(
        registration.code,
        registration.message,
        registration.code === "EMAIL_EXISTS" ? 409 : 400,
        request,
      );
    }

    const login = await loginSocialFlowAuthUser({
      email: body.email,
      password: body.password,
    });
    if (!login.ok) {
      logRuntimeEvent("warn", "auth_registration_login_denied", { correlationId, code: login.code });
      return jsonError(login.code, login.message, 401, request);
    }

    const response = addRuntimeHeaders(NextResponse.json({
      ok: true,
      user: {
        id: registration.userId,
        email: body.email.trim().toLowerCase(),
        role: login.role,
        tenantId: login.tenantId,
        saas_slug: "socialflow",
      },
    }, { status: 201 }), { request, correlationId });

    setSocialFlowSessionCookie({ response, token: login.token, request });
    return response;
  } catch (error) {
    const dbError = respondDatabaseError(error, request);
    if (dbError) return dbError;
    logRuntimeEvent("error", "auth_registration_failed", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return jsonError("SOCIALFLOW_RUNTIME_REGISTRATION_FAILED", "Unable to register SocialFlow user.", 500, request);
  }
}
