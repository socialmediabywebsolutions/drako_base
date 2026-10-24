import { env as resolveEnv } from "@/lib/cf";
import { hashPassword, verifyPassword } from "@/lib/socialflow/platform/auth/crypto";
import { createSocialFlowSessionToken, SOCIALFLOW_SESSION_MAX_AGE_SECONDS } from "@/lib/socialflow/platform/auth/tokens";
import {
  createSocialFlowUserWithCredential,
  findSocialFlowUserWithCredentialByEmail,
  saveSocialFlowSessionRecord,
} from "@/lib/socialflow/platform/auth/repository";
import type { SocialFlowAuthRole } from "@/lib/socialflow/platform/auth/types";

// Copia de registerAuthsUser / loginAuthsUser (src/lib/auths/services.ts) para "socialflow".

async function digestToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveDefaultTenantId(): string {
  const defaultTenantFromBindings = resolveEnv()?.DEFAULT_TENANT_ID;
  return process.env.SOCIALFLOW_DEFAULT_TENANT_ID ?? defaultTenantFromBindings ?? "socialflow-core";
}

// Misma lista y misma semántica que isPlatformAdminEmail (src/lib/auth/platform-admin-allowlist.ts):
// PLATFORM_ADMIN_EMAILS solo desde process.env, y una lista vacía nunca concede admin.
export function isSocialFlowPlatformAdminEmail(email: string): boolean {
  const allowlist = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
  return allowlist.includes(email.trim().toLowerCase());
}

function resolveRole(email: string): "admin" | "user" {
  return isSocialFlowPlatformAdminEmail(email) ? "admin" : "user";
}

export async function registerSocialFlowUser(params: {
  email: string;
  password: string;
  name?: string | null;
  tenantId?: string | null;
}): Promise<
  | { ok: true; userId: string; role: SocialFlowAuthRole; tenantId: string }
  | { ok: false; code: string; message: string }
> {
  const email = params.email.trim().toLowerCase();
  if (!email || !params.password) {
    return { ok: false, code: "INVALID_INPUT", message: "Email and password are required." };
  }
  if (params.password.length < 8) {
    return { ok: false, code: "INVALID_INPUT", message: "Password must contain at least 8 characters." };
  }

  const existing = await findSocialFlowUserWithCredentialByEmail(email);
  if (existing) {
    return { ok: false, code: "EMAIL_EXISTS", message: "Email already registered." };
  }

  const secure = await hashPassword(params.password);
  const role = resolveRole(email);
  const tenantId = params.tenantId?.trim() || resolveDefaultTenantId();
  const userId = crypto.randomUUID();

  const result = await createSocialFlowUserWithCredential({
    userId,
    credentialId: crypto.randomUUID(),
    email,
    name: params.name?.trim() || null,
    role,
    tenantId,
    hash: secure.hash,
    salt: secure.salt,
    iterations: secure.iterations,
  });

  if (!result.ok) {
    return { ok: false, code: result.code, message: result.code };
  }
  return { ok: true, userId, role, tenantId };
}

export async function loginSocialFlowUser(params: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; token: string; role: SocialFlowAuthRole; tenantId: string; userId: string; expiresAt: string }
  | { ok: false; code: string; message: string }
> {
  const email = params.email.trim().toLowerCase();
  const user = await findSocialFlowUserWithCredentialByEmail(email);
  if (!user || user.status !== "active") {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials." };
  }

  const valid = await verifyPassword(params.password, user.hash, user.salt, user.iterations);
  if (!valid) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials." };
  }

  const token = await createSocialFlowSessionToken({
    sub: user.id,
    email: user.email,
    tenantId: user.tenant_id,
    role: user.role,
  });
  const expiresAt = new Date(Date.now() + SOCIALFLOW_SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  await saveSocialFlowSessionRecord({
    sessionId: crypto.randomUUID(),
    userId: user.id,
    tenantId: user.tenant_id,
    tokenHash: await digestToken(token),
    expiresAt,
  });

  return { ok: true, token, role: user.role, tenantId: user.tenant_id, userId: user.id, expiresAt };
}
