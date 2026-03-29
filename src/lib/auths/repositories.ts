import { env as resolveEnv } from "@/lib/cf";
import type { AuthsContext } from "@/lib/auths/types";
import { isAuthsContextDbRequired } from "@/lib/auths/flags";

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
  socialflow: {
    usersTable: "socialflow_users",
    credentialsTable: "socialflow_credentials",
    sessionsTable: "socialflow_sessions",
  },
};

export function resolveAuthsDbForContext(context: AuthsContext): D1Database | null {
  const bindings = resolveEnv();
  if (!bindings) return null;

  if (context === "drakos") {
    if (bindings.DRAKOS_AUTHS_DB) return bindings.DRAKOS_AUTHS_DB;
  } else if (context === "mentorias") {
    if (bindings.MENTORIAS_AUTHS_DB) return bindings.MENTORIAS_AUTHS_DB;
  } else if (context === "socialflow") {
    if ((bindings as typeof bindings & { SOCIALFLOW_AUTHS_DB?: D1Database }).SOCIALFLOW_AUTHS_DB) {
      return (bindings as typeof bindings & { SOCIALFLOW_AUTHS_DB?: D1Database }).SOCIALFLOW_AUTHS_DB ?? null;
    }
    return bindings.DRACO_DB ?? null;
  } else if (context === "bases") {
    if (bindings.BASES_AUTHS_DB) return bindings.BASES_AUTHS_DB;
  }

  if (isAuthsContextDbRequired()) {
    console.error("AUTHS_CONTEXT_DB_MISSING", { context });
    return null;
  }

  return bindings.DRACO_DB ?? null;
}

function getTables(context: Exclude<AuthsContext, "bases">): AuthsTableConfig {
  return TABLES_BY_CONTEXT[context];
}

export async function getAuthsUserById(params: {
  context: Exclude<AuthsContext, "bases">;
  userId: string;
}): Promise<AuthsUserRecord | null> {
  const db = resolveAuthsDbForContext(params.context);
  if (!db) return null;
  const tables = getTables(params.context);

  return db.prepare(
    `SELECT id, email, name, role, tenant_id, status
     FROM ${tables.usersTable}
     WHERE id = ?
     LIMIT 1`,
  ).bind(params.userId).first<AuthsUserRecord>();
}

export async function listAuthsUsersByTenant(params: {
  context: Exclude<AuthsContext, "bases">;
  tenantId: string;
}): Promise<AuthsUserRecord[]> {
  const db = resolveAuthsDbForContext(params.context);
  if (!db) return [];
  const tables = getTables(params.context);
  const { results } = await db.prepare(
    `SELECT id, email, name, role, tenant_id, status
     FROM ${tables.usersTable}
     WHERE tenant_id = ?
     ORDER BY created_at ASC`,
  ).bind(params.tenantId).all<AuthsUserRecord>();
  return results ?? [];
}

export async function findUserWithCredentialByEmail(params: {
  context: Exclude<AuthsContext, "bases">;
  email: string;
}): Promise<(AuthsUserRecord & AuthsCredentialRecord) | null> {
  const db = resolveAuthsDbForContext(params.context);
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
  const db = resolveAuthsDbForContext(params.context);
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

export async function deleteUserWithCredential(params: {
  context: Exclude<AuthsContext, "bases">;
  userId: string;
}): Promise<void> {
  const db = resolveAuthsDbForContext(params.context);
  if (!db) return;
  const tables = getTables(params.context);
  try {
    await db.prepare(`DELETE FROM ${tables.usersTable} WHERE id = ?`).bind(params.userId).run();
  } catch (error) {
    console.error("AUTHS_DELETE_USER_ERROR", error);
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
  const db = resolveAuthsDbForContext(params.context);
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
