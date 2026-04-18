export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { mentoriasAuths } from "@/lib/auths/mentorias-auths";
import { deleteUserWithCredential } from "@/lib/auths/repositories";
import { jsonError, setAuthsSessionCookie } from "@/lib/auths/http";
import { isAuthsIsolationEnabled, isTelemetriesHoldingEnabled } from "@/lib/auths/flags";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { env } from "@/lib/cf";
import { enforceAuthBoundary, resolveSaasSlugForAuthContext } from "@/lib/auths/ssot";

type RegistrationBody = {
  email?: string;
  password?: string;
  name?: string;
  tenantId?: string;
};

export async function POST(request: Request) {
  if (!isAuthsIsolationEnabled()) {
    return jsonError("AUTHS_ISOLATIONS_DISABLED", "Auth isolation is disabled.", 503);
  }

  const boundary = enforceAuthBoundary({ request, expectedContext: "mentorias", endpoint: "/api/mentorias/auths/registrations" });
  if (!boundary.ok) return boundary.response;
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  let body: RegistrationBody | null = null;
  try {
    if (contentType.includes("application/json")) {
      const raw = await request.text();
      try {
        body = JSON.parse(raw) as RegistrationBody;
      } catch {
        body = null;
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const raw = await request.text();
      const params = new URLSearchParams(raw);
      body = {
        email: params.get("email") ?? undefined,
        password: params.get("password") ?? undefined,
        name: params.get("name") ?? undefined,
      };
    } else {
      const raw = await request.text();
      try {
        body = JSON.parse(raw) as RegistrationBody;
      } catch {
        body = null;
      }
    }
  } catch {
    body = null;
  }
  if (!body?.email || !body.password) {
    console.error("[registrations POST] INVALID_INPUT — body parse failed or missing fields", {
      contentType,
      hasEmail: Boolean(body?.email),
      hasPassword: Boolean(body?.password),
    });
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const bindings = env?.();
  if (!bindings?.MENTORIA_DB && !bindings?.DRACO_DB) {
    console.error("[registrations POST] DB bindings not available", {
      hasMentoriaDb: Boolean(bindings?.MENTORIA_DB),
      hasDracoDb: Boolean(bindings?.DRACO_DB),
    });
    return jsonError("DB_UNAVAILABLE", "Database bindings not available. Please try again later.", 503);
  }

  const db = getMentoriaDb(bindings);
  const repository = new MentoriaFamilyRepository(db);
  const familyService = new MentoriaFamilyService(repository);
  const registrationFamily = await familyService.resolveRegistrationFamily({
    email: body.email,
    name: body.name ?? null,
    preferredRole: "tutor",
  });

  const registration = await mentoriasAuths.register({
    context: "mentorias",
    email: body.email,
    password: body.password,
    name: body.name ?? null,
    tenantId: registrationFamily.familyId,
  });
  if (!registration.ok) {
    return jsonError(registration.code, registration.message, registration.code === "EMAIL_EXISTS" ? 409 : 400);
  }

  try {
    console.log("[registrations POST] Iniciando finalizeRegistration", {
      userId: registration.userId,
      email: body.email,
      tenantId: registration.tenantId,
      name: body.name,
      role: registrationFamily.guardianRole,
    });

    await familyService.finalizeRegistration({
      userId: registration.userId,
      email: body.email,
      tenantId: registration.tenantId,
      name: body.name ?? null,
      role: registrationFamily.guardianRole,
    });

    console.log("[registrations POST] finalizeRegistration completado exitosamente");
  } catch (error) {
    console.error("[registrations POST] finalizeRegistration FALLÓ", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId: registration.userId,
      email: body.email,
      tenantId: registration.tenantId,
    });

    await deleteUserWithCredential({ context: "mentorias", userId: registration.userId });
    const message = error instanceof Error ? error.message : "FAMILY_REGISTRATION_FAILED";
    return jsonError(message, "Failed to create family membership.", 500);
  }

  const login = await mentoriasAuths.login({
    context: "mentorias",
    email: body.email,
    password: body.password,
  });
  if (!login.ok) {
    return jsonError(login.code, login.message, 401);
  }

  const familyBundle = await familyService.getFamilyForSession({
    userId: login.userId,
    email: body.email.trim().toLowerCase(),
    tenantId: login.tenantId,
    role: login.role,
  });

  const response = NextResponse.json({
    ok: true,
    user: {
      id: registration.userId,
      email: body.email.trim().toLowerCase(),
      role: login.role,
      tenantId: login.tenantId,
      saas_slug: resolveSaasSlugForAuthContext("mentorias"),
    },
    family: familyBundle.family,
    guardians: familyBundle.guardians,
    students: familyBundle.students,
  }, { status: 201 });

  setAuthsSessionCookie({ response, context: "mentorias", token: login.token, request });

  if (isTelemetriesHoldingEnabled()) {
    try {
      await recordCampamentoEvent({
        tenantId: login.tenantId,
        saasId: null,
        type: "telemetry.user_registered",
        severity: "INFO",
        source: "MENTORIAS_AUTHS",
        message: "User registered in mentorias auth boundary.",
        metadata: { saas_slug: "mentorias", event_name: "user_registered" },
        correlationId: request.headers.get("x-drako-correlation-id") ?? crypto.randomUUID(),
      });
    } catch (error) {
      console.error("[registrations POST] telemetry.user_registered failed", {
        error: error instanceof Error ? error.message : String(error),
        tenantId: login.tenantId,
        userId: login.userId,
      });
    }
  }

  return response;
}
