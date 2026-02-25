import { getDb } from "@/lib/db";
import type { AuthsContext } from "@/lib/auths/types";

type AuthsTableConfig = {
  usersTable: string;
  credentialsTable: string;
  sessionsTable: string;
};

type AuthsUserRecord = {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  tenant_id: string;
  status: string;
};

type AuthsCredentialRecord = {
  id: string;
  user_id: string;
  type: string;
  hash: string;
  salt: string;
  iterations: number;
  algo: string;
};

const TABLES_BY_CONTEXT: Record<Exclude<AuthsContext, "bases">, AuthsTableConfig> = {
  drakos: {
    usersTable: "drakos_users",
    credentialsTable: "drakos_credentials",
    sessionsTable: "drakos_sessions",
  },
  mentorias: {
    usersTable: "mentorias_users",
    credentialsTable: "mentorias_credentials",
    sessionsTable: "mentorias_sessions",
  },
};

function getTables(context: Exclude<AuthsContext, "bases">): AuthsTableConfig {
  return TABLES_BY_CONTEXT[context];
}

export async function findUserWithCredentialByEmail(params: {
  context: Exclude<AuthsContext, "bases">;
  email: string;
}): Promise<(AuthsUserRecord & AuthsCredentialRecord) | null> {
  const db = getDb();
  if (!db) return null;
  const tables = getTables(params.context);

  return db.prepare(
    `SELECT
      u.id, u.email, u.name, u.role, u.tenant_id, u.status,
      c.id as credential_id, c.user_id, c.type, c.hash, c.salt, c.iterations, c.algo
     FROM ${tables.usersTable} u
     JOIN ${tables.credentialsTable} c ON c.user_id = u.id
     WHERE u.email = ?
     LIMIT 1`,
  ).bind(params.email).first<any>().then((row) => {
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
  });
}

export async function createUserWithCredential(params: {
  context: Exclude<AuthsContext, "bases">;
  userId: string;
  credentialId: string;
  email: string;
  name: string | null;
  role: "admin" | "user";
  tenantId: string;
  hash: string;
  salt: string;
  iterations: number;
  algo?: string;
}): Promise<{ ok: true } | { ok: false; code: "EMAIL_EXISTS" | "DB_UNAVAILABLE" | "DB_ERROR" }> {
  const db = getDb();
  if (!db) return { ok: false, code: "DB_UNAVAILABLE" };
  const tables = getTables(params.context);
  const now = new Date().toISOString();
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO ${tables.usersTable} (id, email, name, role, tenant_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
      ).bind(params.userId, params.email, params.name, params.role, params.tenantId, now, now),
      db.prepare(
        `INSERT INTO ${tables.credentialsTable} (id, user_id, type, hash, salt, iterations, algo, created_at, updated_at)
         VALUES (?, ?, 'password', ?, ?, ?, ?, ?, ?)`,
      ).bind(params.credentialId, params.userId, params.hash, params.salt, params.iterations, params.algo ?? "PBKDF2-SHA256", now, now),
    ]);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) {
      return { ok: false, code: "EMAIL_EXISTS" };
    }
    console.error("AUTHS_CREATE_USER_ERROR", { context: params.context, message });
    return { ok: false, code: "DB_ERROR" };
  }
}

export async function saveSessionRecord(params: {
  context: Exclude<AuthsContext, "bases">;
  sessionId: string;
  userId: string;
  tenantId: string;
  tokenHash: string;
  expiresAt: string;
}): Promise<void> {
  const db = getDb();
  if (!db) return;
  const tables = getTables(params.context);
  const now = new Date().toISOString();
  try {
    await db.prepare(
      `INSERT INTO ${tables.sessionsTable} (id, user_id, tenant_id, token_hash, issued_at, expires_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(params.sessionId, params.userId, params.tenantId, params.tokenHash, now, params.expiresAt, now, now).run();
  } catch (error) {
    console.error("AUTHS_SAVE_SESSION_ERROR", error);
  }
}
