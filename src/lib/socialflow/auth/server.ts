import { cookies, headers } from "next/headers";
import { getAuthsCookieName, readCookieFromHeader } from "@/lib/auths/cookies";
import { verifyAuthsSessionToken } from "@/lib/auths/tokens";
import { getAuthsUserById, resolveAuthsDbForContext } from "@/lib/auths/repositories";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";
import {
  readTenantIdFromHeaderGetter,
  validateSocialFlowTenantIsolation,
} from "@/lib/socialflow/auth/tenant-isolation";

export type SocialFlowSession = {
  userId: string;
  email: string;
  name: string | null;
  tenantId: string;
  role: "owner" | "admin" | "user";
  authMode: "isolated" | "local_demo";
  accountType: "influencer" | "empresa" | null;
};

export async function getSocialFlowAccountType(userId: string): Promise<"influencer" | "empresa" | null> {
  const db = resolveAuthsDbForContext("socialflow");
  if (!db) return null;
  const row = await db
    .prepare(`SELECT account_type FROM socialflow_users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ account_type: string | null }>();
  return row?.account_type === "influencer" || row?.account_type === "empresa" ? row.account_type : null;
}

function isTruthyFlag(value: string | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isLocalDemoModeAllowed() {
  const env = typeof process !== "undefined" ? process.env : undefined;
  if (!env) return false;
  if (isTruthyFlag(env.SOCIALFLOW_ALLOW_LOCAL_DEMO_AUTH)) return true;
  return env.NODE_ENV !== "production";
}

export async function getCurrentSocialFlowSession(): Promise<SocialFlowSession | null> {
  const headerStore = await headers();
  const entryMode = headerStore.get("x-drako-client-entry-mode");
  const tenantIdFromHeader = readTenantIdFromHeaderGetter((name) => headerStore.get(name));

  if (entryMode === "local_demo") {
    if (!isLocalDemoModeAllowed()) {
      console.warn("SOCIALFLOW_LOCAL_DEMO_BLOCKED_IN_PRODUCTION");
      return null;
    }

    return {
      userId: "local-demo-user",
      email: "demo@drako.systems",
      name: "Local Demo",
      tenantId: tenantIdFromHeader ?? process.env.DRAKO_CLIENT_DEMO_TENANT_ID ?? DEMO_TENANT_ID,
      role: "admin",
      authMode: "local_demo",
      accountType: null,
    };
  }

  const cookieName = getAuthsCookieName("socialflow");
  const cookieStore = await cookies();
  const token =
    cookieStore.get(cookieName)?.value
    ?? readCookieFromHeader(headerStore.get("cookie"), cookieName);

  if (!token) return null;

  const claims = await verifyAuthsSessionToken(token, "socialflow");
  if (!claims) return null;

  const user = await getAuthsUserById({
    context: "socialflow",
    userId: claims.sub,
  });

  const tenantIsolation = validateSocialFlowTenantIsolation({
    sessionTenantId: claims.tenantId,
    headerTenantId: tenantIdFromHeader,
    authUserTenantId: user?.tenant_id ?? null,
    requireAuthUser: true,
  });

  if (!tenantIsolation.ok) {
    console.error("SOCIALFLOW_SESSION_TENANT_ISOLATION_FAILED", {
      userId: claims.sub,
      reason: tenantIsolation.reason,
      ...tenantIsolation.details,
    });
    return null;
  }

  const accountType = await getSocialFlowAccountType(claims.sub);

  return {
    userId: claims.sub,
    email: claims.email,
    name: user?.name ?? null,
    tenantId: claims.tenantId,
    role: claims.role,
    authMode: "isolated",
    accountType,
  };
}
