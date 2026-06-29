import { hashPassword, verifyPassword } from "@/lib/auth/crypto";
import { env as resolveEnv } from "@/lib/cf";
import { createAuthsSessionToken } from "@/lib/auths/tokens";
import {
  createUserWithCredential,
  findUserWithCredentialByEmail,
  saveSessionRecord,
} from "@/lib/auths/repositories";
import type { AuthsContext } from "@/lib/auths/types";

async function digestToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resolveDefaultTenantId(context: Exclude<AuthsContext, "bases">): string {
  const cfEnv = resolveEnv();
  const defaultTenantFromBindings = cfEnv?.DEFAULT_TENANT_ID;
  if (context === "mentorias") {
    return process.env.MENTORIAS_DEFAULT_TENANT_ID ?? defaultTenantFromBindings ?? "mentoria-core";
  }
  if (context === "socialflow") {
    return process.env.SOCIALFLOW_DEFAULT_TENANT_ID ?? defaultTenantFromBindings ?? "socialflow-core";
  }
  return process.env.DRAKOS_DEFAULT_TENANT_ID ?? defaultTenantFromBindings ?? "demo-tenant";
}

function resolveRole(email: string): "admin" | "user" {
  void email;
  return "user";
}

export async function registerAuthsUser(params: {
  context: Exclude<AuthsContext, "bases">;
  email: string;
  password: string;
  name?: string | null;
  tenantId?: string | null;
}): Promise<
  | { ok: true; userId: string; role: "owner" | "admin" | "user"; tenantId: string }
  | { ok: false; code: string; message: string }
> {
  const email = params.email.trim().toLowerCase();
  if (!email || !params.password) {
    return { ok: false, code: "INVALID_INPUT", message: "Email and password are required." };
  }
  if (params.password.length < 8) {
    return { ok: false, code: "INVALID_INPUT", message: "Password must contain at least 8 characters." };
  }

  const existing = await findUserWithCredentialByEmail({ context: params.context, email });
  if (existing) {
    return { ok: false, code: "EMAIL_EXISTS", message: "Email already registered." };
  }

  const secure = await hashPassword(params.password);
  const role = resolveRole(email);
  const tenantId = params.tenantId?.trim() || resolveDefaultTenantId(params.context);
  const userId = crypto.randomUUID();
  const credentialId = crypto.randomUUID();

  const result = await createUserWithCredential({
    context: params.context,
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

export async function loginAuthsUser(params: {
  context: Exclude<AuthsContext, "bases">;
  email: string;
  password: string;
}): Promise<
  | { ok: true; token: string; role: "owner" | "admin" | "user"; tenantId: string; userId: string; expiresAt: string }
  | { ok: false; code: string; message: string }
> {
  const email = params.email.trim().toLowerCase();
  const user = await findUserWithCredentialByEmail({
    context: params.context,
    email,
  });
  if (!user || user.status !== "active") {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials." };
  }

  const valid = await verifyPassword(params.password, user.hash, user.salt, user.iterations);
  if (!valid) {
    return { ok: false, code: "INVALID_CREDENTIALS", message: "Invalid credentials." };
  }

  const token = await createAuthsSessionToken({
    context: params.context,
    sub: user.id,
    email: user.email,
    tenantId: user.tenant_id,
    role: user.role,
  });
  const expiresAt = new Date(Date.now() + 60 * 60 * 8 * 1000).toISOString();
  await saveSessionRecord({
    context: params.context,
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
