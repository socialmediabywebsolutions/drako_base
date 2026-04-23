import { getAuthsCookieCandidateNames, readCookieFromHeader } from "@/lib/auths/cookies";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { env } from "@/lib/cf";
import { MentoriaFamilyRepository } from "@/lib/mentoria/family-repository";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";
import { MentoriaRepository } from "@/lib/mentoria/repository";
import type { MentoriaSessionContext } from "@/lib/mentoria/types";
import type { UserContext } from "@/lib/drako/memory";

export type MentoriaRequestSession = Pick<UserContext, "userId" | "email" | "tenantId"> & {
  role: "admin" | "user";
} & MentoriaSessionContext;

async function resolveMentoriaSessionContext(input: Pick<MentoriaRequestSession, "userId" | "email" | "tenantId">): Promise<MentoriaSessionContext> {
  const db = getMentoriaDb(env?.());
  const repository = new MentoriaRepository(db);
  const familyRepository = new MentoriaFamilyRepository(db);

  if (input.email) {
    const guardian = await familyRepository.getGuardianByFamilyAndEmail(input.tenantId, input.email).catch(() => null);
    if (guardian) {
      const accessibleStudents = await repository.listGuardianAccessibleStudents(input.tenantId, input.userId).catch(() => []);
      const preferredAccess = accessibleStudents.find((item) => item.guardianId === guardian.id)
        ?? accessibleStudents[0]
        ?? null;
      return {
        actorType: "guardian",
        familyId: guardian.familyId ?? input.tenantId,
        guardianId: guardian.id,
        studentProfileId: preferredAccess?.studentProfileId ?? null,
        systemRole: guardian.systemRole,
      };
    }
  }

  const student = await repository.getStudentProfileByUser(input.tenantId, input.userId).catch(() => null);
  if (student) {
    return {
      actorType: "student",
      familyId: input.tenantId,
      guardianId: null,
      studentProfileId: student.id,
      systemRole: "student",
    };
  }

  return {
    actorType: "unknown",
    familyId: input.tenantId,
    guardianId: null,
    studentProfileId: null,
    systemRole: null,
  };
}

export async function getCurrentMentoriaSessionFromRequest(request: Request): Promise<MentoriaRequestSession | null> {
  const cookieHeader = request.headers.get("cookie");
  const token = getAuthsCookieCandidateNames("mentorias", request)
    .map((cookieName) => readCookieFromHeader(cookieHeader, cookieName))
    .find((value): value is string => Boolean(value));
  if (!token) return null;

  const claims = await verifyAuthsSessionToken(token, "mentorias");
  if (!claims) return null;

  const sessionBase = {
    userId: claims.sub,
    email: claims.email,
    tenantId: claims.tenantId,
  };
  const sessionContext = await resolveMentoriaSessionContext(sessionBase);

  return {
    ...sessionBase,
    role: claims.role,
    ...sessionContext,
  };
}

export async function requireCurrentMentoriaSession(request: Request): Promise<MentoriaRequestSession> {
  const session = await getCurrentMentoriaSessionFromRequest(request);
  if (!session) {
    // Local-dev smoke test override: allow passing session via headers when explicitly requested
    const devOverride = request.headers.get("x-mentoria-dev-override") === "1";
    if (devOverride) {
      const userId = request.headers.get("x-mentoria-user-id") ?? crypto.randomUUID();
      const email = request.headers.get("x-mentoria-email") ?? "smoke@example.com";
      const tenantId = request.headers.get("x-mentoria-tenant-id") ?? "mentoria-core";
      const roleHeader = (request.headers.get("x-mentoria-role") ?? "user").toLowerCase();
      const role: "admin" | "user" = roleHeader === "admin" ? "admin" : "user";
      const sessionContext = await resolveMentoriaSessionContext({ userId, email, tenantId });
      return { userId, email, tenantId, role, ...sessionContext };
    }
    throw new Error("SESSION_REQUIRED");
  }
  return session;
}
