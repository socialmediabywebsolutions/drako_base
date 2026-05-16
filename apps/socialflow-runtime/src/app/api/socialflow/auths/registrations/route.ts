export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { respondDatabaseError } from "../../../../../lib/db/runtime-db";
import { jsonError, setSocialFlowSessionCookie } from "../../../../../lib/auth/http";
import { loginSocialFlowAuthUser, registerSocialFlowAuthUser } from "../../../../../lib/auth/service";

type RegistrationBody = {
  email?: string;
  password?: string;
  name?: string;
  tenantId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as RegistrationBody | null;
    if (!body?.email || !body.password) {
      return jsonError("INVALID_INPUT", "Email and password are required.");
    }

    const registration = await registerSocialFlowAuthUser({
      email: body.email,
      password: body.password,
      name: body.name ?? null,
      tenantId: body.tenantId ?? null,
    });
    if (!registration.ok) {
      return jsonError(
        registration.code,
        registration.message,
        registration.code === "EMAIL_EXISTS" ? 409 : 400,
      );
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
      user: {
        id: registration.userId,
        email: body.email.trim().toLowerCase(),
        role: login.role,
        tenantId: login.tenantId,
        saas_slug: "socialflow",
      },
    }, { status: 201 });

    setSocialFlowSessionCookie({ response, token: login.token, request });
    return response;
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    console.error("SOCIALFLOW_RUNTIME_REGISTRATION_ERROR", error);
    return jsonError("SOCIALFLOW_RUNTIME_REGISTRATION_FAILED", "Unable to register SocialFlow user.", 500);
  }
}
