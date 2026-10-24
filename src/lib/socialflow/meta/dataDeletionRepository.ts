// Registro de solicitudes de borrado de datos vía Meta Data Deletion Callback — solo
// para que /privacidad/datos-eliminados pueda mostrar un estado real al usuario/a Meta,
// no una respuesta hardcodeada. No es SocialContext (tenant conocido de antemano) porque
// en el momento de recibir el callback todavía no sabemos a qué tenant pertenece —
// eso se resuelve en el propio endpoint antes de llamar aquí.

const schemaCache = new WeakMap<D1Database, Promise<void>>();

function generateId() {
  try {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function runStatement(db: D1Database, sql: string, ...params: unknown[]) {
  const stmt = db.prepare(sql);
  return (params.length ? stmt.bind(...params) : stmt).run();
}

async function queryRows<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  const stmt = db.prepare(sql);
  const result = await (params.length ? stmt.bind(...params) : stmt).all<T>();
  return result.results ?? [];
}

async function queryFirst<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  const rows = await queryRows<T>(db, sql, ...params);
  return rows[0] ?? null;
}

async function ensureDataDeletionSchemaInner(db: D1Database): Promise<void> {
  await runStatement(
    db,
    `CREATE TABLE IF NOT EXISTS socialflow_data_deletion_requests (
      id TEXT PRIMARY KEY,
      confirmation_code TEXT NOT NULL UNIQUE,
      tenant_id TEXT,
      ig_user_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PROCESSED',
      accounts_deleted INTEGER NOT NULL DEFAULT 0,
      threads_deleted INTEGER NOT NULL DEFAULT 0,
      leads_deleted INTEGER NOT NULL DEFAULT 0,
      requested_at TEXT NOT NULL,
      processed_at TEXT
    )`,
  );
  await runStatement(
    db,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_sf_data_deletion_confirmation
     ON socialflow_data_deletion_requests (confirmation_code)`,
  );
}

export async function ensureDataDeletionSchema(db: D1Database): Promise<void> {
  const existing = schemaCache.get(db);
  if (existing) return existing;
  const promise = ensureDataDeletionSchemaInner(db);
  schemaCache.set(db, promise);
  try {
    await promise;
  } catch (error) {
    schemaCache.delete(db);
    throw error;
  }
  return promise;
}

export type DataDeletionRequestRecord = {
  id: string;
  confirmationCode: string;
  tenantId: string | null;
  igUserId: string;
  status: string;
  accountsDeleted: number;
  threadsDeleted: number;
  leadsDeleted: number;
  requestedAt: string;
  processedAt: string | null;
};

type DataDeletionRow = {
  id: string;
  confirmation_code: string;
  tenant_id: string | null;
  ig_user_id: string;
  status: string;
  accounts_deleted: number;
  threads_deleted: number;
  leads_deleted: number;
  requested_at: string;
  processed_at: string | null;
};

function mapRow(row: DataDeletionRow): DataDeletionRequestRecord {
  return {
    id: row.id,
    confirmationCode: row.confirmation_code,
    tenantId: row.tenant_id,
    igUserId: row.ig_user_id,
    status: row.status,
    accountsDeleted: row.accounts_deleted,
    threadsDeleted: row.threads_deleted,
    leadsDeleted: row.leads_deleted,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
  };
}

export async function createDataDeletionRequest(
  db: D1Database,
  input: { igUserId: string; tenantId: string | null; accountsDeleted: number; threadsDeleted: number; leadsDeleted: number },
): Promise<DataDeletionRequestRecord> {
  await ensureDataDeletionSchema(db);
  const id = generateId();
  const confirmationCode = generateId();
  const now = nowIso();
  await runStatement(
    db,
    `INSERT INTO socialflow_data_deletion_requests
     (id, confirmation_code, tenant_id, ig_user_id, status, accounts_deleted, threads_deleted, leads_deleted, requested_at, processed_at)
     VALUES (?, ?, ?, ?, 'PROCESSED', ?, ?, ?, ?, ?)`,
    id,
    confirmationCode,
    input.tenantId,
    input.igUserId,
    input.accountsDeleted,
    input.threadsDeleted,
    input.leadsDeleted,
    now,
    now,
  );
  return {
    id,
    confirmationCode,
    tenantId: input.tenantId,
    igUserId: input.igUserId,
    status: "PROCESSED",
    accountsDeleted: input.accountsDeleted,
    threadsDeleted: input.threadsDeleted,
    leadsDeleted: input.leadsDeleted,
    requestedAt: now,
    processedAt: now,
  };
}

export async function getDataDeletionRequestByConfirmationCode(
  db: D1Database,
  confirmationCode: string,
): Promise<DataDeletionRequestRecord | null> {
  await ensureDataDeletionSchema(db);
  const row = await queryFirst<DataDeletionRow>(
    db,
    `SELECT id, confirmation_code, tenant_id, ig_user_id, status, accounts_deleted, threads_deleted, leads_deleted, requested_at, processed_at
     FROM socialflow_data_deletion_requests WHERE confirmation_code = ? LIMIT 1`,
    confirmationCode,
  );
  return row ? mapRow(row) : null;
}
