import { env as resolveEnv } from "@/lib/cf";
import type {
  SocialFlowAuthCredentialRecord,
  SocialFlowAuthRole,
  SocialFlowAuthUserRecord,
} from "@/lib/socialflow/platform/auth/types";

// Copia de src/lib/auths/repositories.ts para el contexto "socialflow": mismas tablas,
// mismas consultas y mismo fail-closed si falta el binding SOCIALFLOW_AUTHS_DB.

export function resolveSocialFlowAuthsDb(): D1Database | null {
  const bindings = resolveEnv();
  if (!bindings) return null;
  const db = (bindings as typeof bindings & { SOCIALFLOW_AUTHS_DB?: D1Database }).SOCIALFLOW_AUTHS_DB;
  if (db) return db;
  console.error("AUTHS_CONTEXT_DB_MISSING", {
    context: "socialflow",
    message: "SOCIALFLOW_AUTHS_DB binding is required for socialflow auth",
  });
  return null;
}

export async function getSocialFlowAuthUserById(userId: string): Promise<SocialFlowAuthUserRecord | null> {
  const db = resolveSocialFlowAuthsDb();
  if (!db) return null;
  return db.prepare(
    `SELECT id, email, name, role, tenant_id, status
     FROM socialflow_users
     WHERE id = ?
     LIMIT 1`,
  ).bind(userId).first<SocialFlowAuthUserRecord>();
}

export async function listSocialFlowAuthUsersByTenant(tenantId: string): Promise<SocialFlowAuthUserRecord[]> {
  const db = resolveSocialFlowAuthsDb();
  if (!db) return [];
  const { results } = await db.prepare(
    `SELECT id, email, name, role, tenant_id, status
     FROM socialflow_users
     WHERE tenant_id = ?
     ORDER BY created_at ASC`,
  ).bind(tenantId).all<SocialFlowAuthUserRecord>();
  return results ?? [];
}

type UserWithCredentialRow = SocialFlowAuthUserRecord & SocialFlowAuthCredentialRecord & { credential_id: string };

export async function findSocialFlowUserWithCredentialByEmail(
  email: string,
): Promise<(SocialFlowAuthUserRecord & SocialFlowAuthCredentialRecord) | null> {
  const db = resolveSocialFlowAuthsDb();
  if (!db) return null;
  const row = await db.prepare(
    `SELECT
      u.id, u.email, u.name, u.role, u.tenant_id, u.status,
      c.id as credential_id, c.user_id, c.type, c.hash, c.salt, c.iterations, c.algo
     FROM socialflow_users u
     JOIN socialflow_credentials c ON c.user_id = u.id
     WHERE u.email = ?
     LIMIT 1`,
  ).bind(email).first<UserWithCredentialRow>();
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tenant_id: row.tenant_id,
    status: row.status,
    user_id: row.user_id,
    type: row.type,
    hash: row.hash,
    salt: row.salt,
    iterations: row.iterations,
    algo: row.algo,
  };
}

export async function createSocialFlowUserWithCredential(params: {
  userId: string;
  credentialId: string;
  email: string;
  name: string | null;
  role: SocialFlowAuthRole;
  tenantId: string;
  hash: string;
  salt: string;
  iterations: number;
  algo?: string;
}): Promise<{ ok: true } | { ok: false; code: "EMAIL_EXISTS" | "DB_UNAVAILABLE" | "DB_ERROR" }> {
  const db = resolveSocialFlowAuthsDb();
  if (!db) return { ok: false, code: "DB_UNAVAILABLE" };
  const now = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO socialflow_users (id, email, name, role, tenant_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      ).bind(params.userId, params.email, params.name, params.role, params.tenantId, now, now),
      db.prepare(
        `INSERT INTO socialflow_credentials (id, user_id, type, hash, salt, iterations, algo, created_at, updated_at)
         VALUES (?, ?, 'password', ?, ?, ?, ?, ?, ?)`,
      ).bind(params.credentialId, params.userId, params.hash, params.salt, params.iterations, params.algo ?? "PBKDF2-SHA256", now, now),
    ]);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) {
      return { ok: false, code: "EMAIL_EXISTS" };
    }
    console.error("AUTHS_CREATE_USER_ERROR", { context: "socialflow", message });
    return { ok: false, code: "DB_ERROR" };
  }
}

export async function saveSocialFlowSessionRecord(params: {
  sessionId: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: string;
}): Promise<void> {
  const db = resolveSocialFlowAuthsDb();
  if (!db) return;
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO socialflow_sessions (id, user_id, tenant_id, token_hash, issued_at, expires_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(params.sessionId, params.userId, params.tenantId, params.tokenHash, now, params.expiresAt, now, now).run();
  } catch (error) {
    console.error("AUTHS_SAVE_SESSION_ERROR", error);
  }
}
