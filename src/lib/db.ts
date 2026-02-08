import { env, type DracoEnv } from "./cf";

export type DatabaseUnavailableReason = "binding-missing" | "migrations-missing" | "table-missing";

export class DatabaseUnavailableError extends Error {
  constructor(public reason: DatabaseUnavailableReason, message?: string) {
    super(message ?? reason);
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * OLIMPO: Check if database is available without throwing
 */
export function isDatabaseAvailable(): boolean {
  const bindings = env();
  return Boolean(bindings?.DRACO_DB);
}

export function getRequestBindings(): DracoEnv | null {
  const bindings = env();
  return bindings;
}

export function getDracoDbFromRequestContext(): D1Database | null {
  const bindings = getRequestBindings();
  if (!bindings?.DRACO_DB) {
    return null;
  }
  return bindings.DRACO_DB;
}

/**
 * OLIMPO: Returns null instead of throwing when DB unavailable
 */
export function getDb(): D1Database | null {
  return getDracoDbFromRequestContext();
}

export async function withDb<T>(fn: (db: D1Database) => Promise<T>): Promise<T | null> {
  const db = getDb();
  if (!db) {
    return null;
  }
  return fn(db);
}

export function ensureDatabase(): D1Database {
  const db = getDb();
  if (!db) {
    throw new DatabaseUnavailableError("binding-missing", "DRACO_DB binding is missing in environment.");
  }
  return db;
}

function normalizeDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/no such table/i.test(message)) {
    console.error("DB_TABLE_MISSING", message);
    throw new DatabaseUnavailableError("table-missing", message);
  }
  if (/no such column/i.test(message)) {
    console.error("DB_MIGRATION_MISSING", message);
    throw new DatabaseUnavailableError("migrations-missing", message);
  }
  throw error instanceof Error ? error : new Error(message);
}

export async function queryAll<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  try {
    const db = getDb();
    if (!db) {
      // OLIMPO: DB unavailable (e.g., Vercel), return empty array
      return [];
    }
    const stmt = db.prepare(sql);
    const bound = params.length ? stmt.bind(...params) : stmt;
    const res = await bound.all<T>();
    return res.results ?? [];
  } catch (error) {
    normalizeDbError(error);
  }
}

export async function queryOne<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  const rows = await queryAll<T>(sql, ...params);
  if (!rows || rows.length === 0) return null;
  return rows[0];
}

export async function run(sql: string, ...params: unknown[]): Promise<boolean> {
  try {
    const db = getDb();
    if (!db) {
      // OLIMPO: DB unavailable (e.g., Vercel), return false
      return false;
    }
    const stmt = db.prepare(sql);
    const bound = params.length ? stmt.bind(...params) : stmt;
    const res = await bound.run();
    return Boolean(res?.success);
  } catch (error) {
    normalizeDbError(error);
  }
}
