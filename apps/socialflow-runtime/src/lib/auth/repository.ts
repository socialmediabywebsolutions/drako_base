import { ensureSocialFlowAuthDb, queryAll, queryOne } from "../db/runtime-db";
import type { SocialFlowAuthCredentialRecord, SocialFlowAuthUserRecord, SocialFlowRole } from "./types";

const USERS_TABLE = "socialflow_users";
const CREDENTIALS_TABLE = "socialflow_credentials";
const SESSIONS_TABLE = "socialflow_sessions";

export async function getSocialFlowAuthUserById(userId: string): Promise<SocialFlowAuthUserRecord | null> {
  return queryOne<SocialFlowAuthUserRecord>(
    ensureSocialFlowAuthDb(),
    `SELECT id, email, name, role, tenant_id, status
     FROM ${USERS_TABLE}
     WHERE id = ?
     LIMIT 1`,
    userId,
  );
}

export async function listSocialFlowAuthUsersByTenant(tenantId: string): Promise<SocialFlowAuthUserRecord[]> {
  return queryAll<SocialFlowAuthUserRecord>(
    ensureSocialFlowAuthDb(),
    `SELECT id, email, name, role, tenant_id, status
     FROM ${USERS_TABLE}
     WHERE tenant_id = ?
     ORDER BY created_at ASC`,
    tenantId,
  );
}

export async function findSocialFlowUserWithCredentialByEmail(email: string): Promise<
  (SocialFlowAuthUserRecord & SocialFlowAuthCredentialRecord) | null
> {
  const row = await ensureSocialFlowAuthDb().prepare(
    `SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      u.tenant_id,
      u.status,
      c.user_id,
      c.hash,
      c.salt,
      c.iterations,
      c.algo
     FROM ${USERS_TABLE} u
     JOIN ${CREDENTIALS_TABLE} c ON c.user_id = u.id
     WHERE u.email = ?
     LIMIT 1`,
  ).bind(email).first<any>();

  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tenant_id: row.tenant_id,
    status: row.status,
    user_id: row.user_id,
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
  role: SocialFlowRole;
  tenantId: string;
  hash: string;
  salt: string;
  iterations: number;
  algo?: string;
}): Promise<{ ok: true } | { ok: false; code: "EMAIL_EXISTS" | "DB_ERROR" }> {
  const db = ensureSocialFlowAuthDb();
  const now = new Date().toISOString();

  try {
    await db.batch([
      db.prepare(
        `INSERT INTO ${USERS_TABLE} (id, email, name, role, tenant_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      ).bind(params.userId, params.email, params.name, params.role, params.tenantId, now, now),
      db.prepare(
        `INSERT INTO ${CREDENTIALS_TABLE} (id, user_id, type, hash, salt, iterations, algo, created_at, updated_at)
         VALUES (?, ?, 'password', ?, ?, ?, ?, ?, ?)`,
      ).bind(
        params.credentialId,
        params.userId,
        params.hash,
        params.salt,
        params.iterations,
        params.algo ?? "PBKDF2-SHA256",
        now,
        now,
      ),
    ]);

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) {
      return { ok: false, code: "EMAIL_EXISTS" };
    }

    console.error("SOCIALFLOW_RUNTIME_CREATE_AUTH_USER_ERROR", { message });
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
  const now = new Date().toISOString();
  await ensureSocialFlowAuthDb().prepare(
    `INSERT INTO ${SESSIONS_TABLE} (id, user_id, tenant_id, token_hash, issued_at, expires_at, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).bind(
    params.sessionId,
    params.userId,
    params.tenantId,
    params.tokenHash,
    now,
    params.expiresAt,
    now,
    now,
  ).run();
}
