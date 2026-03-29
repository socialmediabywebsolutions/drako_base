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
  const body = (await request.json().catch(() => null)) as RegistrationBody | null;
  if (!body?.email || !body.password) {
    return jsonError("INVALID_INPUT", "Email and password are required.");
  }

  const db = getMentoriaDb(env?.());
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
    await familyService.finalizeRegistration({
      userId: registration.userId,
      email: body.email,
      tenantId: registration.tenantId,
      name: body.name ?? null,
      role: registrationFamily.guardianRole,
    });
  } catch (error) {
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

  setAuthsSessionCookie({ response, context: "mentorias", token: login.token });

  if (isTelemetriesHoldingEnabled()) {
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
  }

  return response;
}
