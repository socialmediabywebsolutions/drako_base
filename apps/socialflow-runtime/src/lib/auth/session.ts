import { cookies, headers } from "next/headers";
import { getSocialFlowCookieCandidateNames, readCookieFromHeader } from "./cookies";
import { getSocialFlowAuthUserById } from "./repository";
import { readTenantIdFromHeaderGetter, validateSocialFlowTenantIsolation } from "./tenant-isolation";
import { verifySocialFlowSessionToken } from "./tokens";
import type { SocialFlowRequestSession, SocialFlowSession } from "./types";
import { getRuntimeCorrelationId, logRuntimeEvent } from "../runtime-observability";

function readCookieValue(cookieHeader: string | null, candidateNames: string[]): string | null {
  for (const name of candidateNames) {
    const value = readCookieFromHeader(cookieHeader, name);
    if (value) {
      return value;
    }
  }

  return null;
}

export async function readSocialFlowRuntimeTokenSession(request: Request): Promise<SocialFlowRequestSession | null> {
  const candidateNames = getSocialFlowCookieCandidateNames(request);
  const token = readCookieValue(request.headers.get("cookie"), candidateNames);
  if (!token) return null;

  const claims = await verifySocialFlowSessionToken(token);
  if (!claims) return null;

  return {
    userId: claims.sub,
    email: claims.email,
    tenantId: claims.tenantId,
    role: claims.role,
  };
}

export async function getCurrentSocialFlowSessionFromRequest(request: Request): Promise<SocialFlowRequestSession | null> {
  const session = await readSocialFlowRuntimeTokenSession(request);
  if (!session) return null;

  const user = await getSocialFlowAuthUserById(session.userId);
  const tenantIsolation = validateSocialFlowTenantIsolation({
    sessionTenantId: session.tenantId,
    headerTenantId: readTenantIdFromHeaderGetter((name) => request.headers.get(name)),
    authUserTenantId: user?.tenant_id ?? null,
    requireAuthUser: true,
  });

  if (!tenantIsolation.ok) {
    console.error("SOCIALFLOW_RUNTIME_REQUEST_TENANT_ISOLATION_FAILED", {
      userId: session.userId,
      reason: tenantIsolation.reason,
      ...tenantIsolation.details,
    });
    return null;
  }

  logRuntimeEvent("log", "session_resolved", {
    correlationId: getRuntimeCorrelationId(request),
    tenantId: session.tenantId,
    role: session.role,
  });

  return session;
}

export async function requireCurrentSocialFlowSession(request: Request): Promise<SocialFlowRequestSession> {
  const session = await getCurrentSocialFlowSessionFromRequest(request);
  if (!session) {
    throw new Error("SESSION_REQUIRED");
  }
  return session;
}

export async function getCurrentSocialFlowSession(): Promise<SocialFlowSession | null> {
  const headerStore = await headers();
  const cookieStore = await cookies();
  const candidateNames = getSocialFlowCookieCandidateNames(headerStore);

  let token: string | null = null;
  for (const name of candidateNames) {
    token = cookieStore.get(name)?.value ?? null;
    if (token) break;
  }
  token ??= readCookieValue(headerStore.get("cookie"), candidateNames);
  if (!token) return null;

  const claims = await verifySocialFlowSessionToken(token);
  if (!claims) return null;

  const user = await getSocialFlowAuthUserById(claims.sub);
  const tenantIsolation = validateSocialFlowTenantIsolation({
    sessionTenantId: claims.tenantId,
    headerTenantId: readTenantIdFromHeaderGetter((name) => headerStore.get(name)),
    authUserTenantId: user?.tenant_id ?? null,
    requireAuthUser: true,
  });

  if (!tenantIsolation.ok) {
    console.error("SOCIALFLOW_RUNTIME_SESSION_TENANT_ISOLATION_FAILED", {
      userId: claims.sub,
      reason: tenantIsolation.reason,
      ...tenantIsolation.details,
    });
    return null;
  }

  return {
    userId: claims.sub,
    email: claims.email,
    name: user?.name ?? null,
    tenantId: claims.tenantId,
    role: claims.role,
    authMode: "isolated",
  };
}
