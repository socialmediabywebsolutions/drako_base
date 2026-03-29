import { getAuthsCookieName } from "@/lib/auths/cookies";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import type { UserContext } from "@/lib/drako/memory";

export type MentoriaRequestSession = Pick<UserContext, "userId" | "email" | "tenantId"> & {
  role: "admin" | "user";
};

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(/;\s*/)) {
    const [cookieName, ...rest] = part.split("=");
    if (cookieName === name) return rest.join("=");
  }
  return null;
}

export async function getCurrentMentoriaSessionFromRequest(request: Request): Promise<MentoriaRequestSession | null> {
  const cookieName = getAuthsCookieName("mentorias");
  const token = readCookieValue(request.headers.get("cookie"), cookieName);
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
    throw new Error("SESSION_REQUIRED");
  }
  return session;
}
