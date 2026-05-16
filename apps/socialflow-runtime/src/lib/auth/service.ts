import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { getSocialFlowRuntimeEnv } from "../runtime-env";
import { createSocialFlowSessionToken } from "./tokens";
import {
  createSocialFlowUserWithCredential,
  findSocialFlowUserWithCredentialByEmail,
  saveSocialFlowSessionRecord,
} from "./repository";
import type { SocialFlowRole } from "./types";

async function digestToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveDefaultTenantId(): string | null {
  const runtimeEnv = getSocialFlowRuntimeEnv();
  return runtimeEnv?.DEFAULT_TENANT_ID?.trim() || null;
}

function resolveRole(_email: string): SocialFlowRole {
  return "user";
}

export async function registerSocialFlowAuthUser(params: {
  email: string;
  password: string;
  name?: string | null;
  tenantId?: string | null;
}): Promise<
  | { ok: true; userId: string; role: SocialFlowRole; tenantId: string }
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
  if (!tenantId) {
    return { ok: false, code: "TENANT_REQUIRED", message: "tenantId is required until DEFAULT_TENANT_ID is configured." };
  }
  const userId = crypto.randomUUID();
  const credentialId = crypto.randomUUID();

  const result = await createSocialFlowUserWithCredential({
    userId,
    credentialId,
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

export async function loginSocialFlowAuthUser(params: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; token: string; role: SocialFlowRole; tenantId: string; userId: string; expiresAt: string }
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
  const expiresAt = new Date(Date.now() + 60 * 60 * 8 * 1000).toISOString();

  await saveSocialFlowSessionRecord({
    sessionId: crypto.randomUUID(),
    userId: user.id,
    tenantId: user.tenant_id,
    tokenHash: await digestToken(token),
    expiresAt,
  });

  return {
    ok: true,
    token,
    role: user.role,
    tenantId: user.tenant_id,
    userId: user.id,
    expiresAt,
  };
}
