import { getAuthsCookieCandidateNames, readCookieFromHeader } from "@/lib/auths/cookies";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import type { UserContext } from "@/lib/drako/memory";

export type MentoriaRequestSession = Pick<UserContext, "userId" | "email" | "tenantId"> & {
  role: "admin" | "user";
};

export async function getCurrentMentoriaSessionFromRequest(request: Request): Promise<MentoriaRequestSession | null> {
  const cookieHeader = request.headers.get("cookie");
  const token = getAuthsCookieCandidateNames("mentorias", request)
    .map((cookieName) => readCookieFromHeader(cookieHeader, cookieName))
    .find((value): value is string => Boolean(value));
  if (!token) return null;

  const claims = await verifyAuthsSessionToken(token, "mentorias");
  if (!claims) return null;

  return {
    userId: claims.sub,
    email: claims.email,
    tenantId: claims.tenantId,
    role: claims.role,
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
      return { userId, email, tenantId, role };
    }
    throw new Error("SESSION_REQUIRED");
  }
  return session;
}
