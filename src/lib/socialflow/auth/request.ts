import { getAuthsCookieName } from "@/lib/auths/cookies";
import { getAuthsUserById } from "@/lib/auths/repositories";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import {
  readTenantIdFromHeaderGetter,
  validateSocialFlowTenantIsolation,
} from "@/lib/socialflow/auth/tenant-isolation";

export type SocialFlowRequestSession = {
  userId: string;
  email: string;
  tenantId: string;
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

export async function getCurrentSocialFlowSessionFromRequest(request: Request): Promise<SocialFlowRequestSession | null> {
  const cookieName = getAuthsCookieName("socialflow");
  const token = readCookieValue(request.headers.get("cookie"), cookieName);
  if (!token) return null;

  const claims = await verifyAuthsSessionToken(token, "socialflow");
  if (!claims) return null;

  const user = await getAuthsUserById({
    context: "socialflow",
    userId: claims.sub,
  });
  const tenantIsolation = validateSocialFlowTenantIsolation({
    sessionTenantId: claims.tenantId,
    headerTenantId: readTenantIdFromHeaderGetter((name) => request.headers.get(name)),
    authUserTenantId: user?.tenant_id ?? null,
    requireAuthUser: true,
  });

  if (!tenantIsolation.ok) {
    console.error("SOCIALFLOW_REQUEST_TENANT_ISOLATION_FAILED", {
      userId: claims.sub,
      reason: tenantIsolation.reason,
      ...tenantIsolation.details,
    });
    return null;
  }

  return {
    userId: claims.sub,
    email: claims.email,
    tenantId: claims.tenantId,
    role: claims.role,
  };
}

export async function requireCurrentSocialFlowSession(request: Request): Promise<SocialFlowRequestSession> {
  const session = await getCurrentSocialFlowSessionFromRequest(request);
  if (!session) {
    throw new Error("SESSION_REQUIRED");
  }
  return session;
}
