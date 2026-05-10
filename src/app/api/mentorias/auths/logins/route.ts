export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { mentoriasAuths } from "@/lib/auths/mentorias-auths";
import { jsonError, setAuthsSessionCookie } from "@/lib/auths/http";
import { isAuthsIsolationEnabled } from "@/lib/auths/flags";
import { MentoriaFamilyService } from "@/lib/mentoria/family-service";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { MentoriaRepository } from "@/lib/mentoria/repository";
import { env } from "@/lib/cf";
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

  const bindings = env?.();
  if (!bindings?.MENTORIA_DB) {
    return jsonError("DB_UNAVAILABLE", "MENTORIA_DB binding is required for Mentoria product runtime.", 503);
  }

  const db = getMentoriaDb(bindings);
  const repository = new MentoriaFamilyRepository(db);
  const familyService = new MentoriaFamilyService(repository);
  const mentoriaRepository = new MentoriaRepository(db);
  const normalizedEmail = body.email.trim().toLowerCase();
  let familyBundle:
    | Awaited<ReturnType<MentoriaFamilyService["getFamilyForSession"]>>
    | null = null;
  try {
    familyBundle = await familyService.getFamilyForSession({
      userId: login.userId,
      email: normalizedEmail,
      tenantId: login.tenantId,
      role: login.role,
      actorType: "guardian",
      familyId: login.tenantId,
      guardianId: null,
      studentProfileId: null,
      systemRole: null,
    });
  } catch {
    familyBundle = null;
  }
  const studentProfile = familyBundle ? null : await mentoriaRepository.getStudentProfileByUser(login.tenantId, login.userId).catch(() => null);
  if (!familyBundle && !studentProfile) {
    return jsonError("FAMILY_ACCESS_DENIED", "No tienes acceso vinculado a Mentoría.", 403);
  }

  const response = NextResponse.json({
    ok: true,
    role: login.role,
    tenantId: login.tenantId,
    saas_slug: resolveSaasSlugForAuthContext("mentorias"),
    actorType: studentProfile ? "student" : "guardian",
    student: studentProfile,
    family: familyBundle?.family ?? null,
    guardians: familyBundle?.guardians ?? [],
    students: familyBundle?.students ?? [],
  });
  setAuthsSessionCookie({ response, context: "mentorias", token: login.token, request });
  return response;
}
