import { env } from "@/lib/cf";

export type DatabaseUnavailableReason = "binding-missing" | "migrations-missing" | "table-missing";

export class DatabaseUnavailableError extends Error {
  constructor(public reason: DatabaseUnavailableReason, message?: string) {
    super(message ?? reason);
    this.name = "DatabaseUnavailableError";
  }
}

export function ensureDatabase(): D1Database {
  const bindings = env();
  if (!bindings?.DRACO_DB) {
    throw new DatabaseUnavailableError("binding-missing", "DRACO_DB binding is missing");
  }
  return bindings.DRACO_DB;
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
    const db = ensureDatabase();
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
    const db = ensureDatabase();
    const stmt = db.prepare(sql);
    const bound = params.length ? stmt.bind(...params) : stmt;
    const res = await bound.run();
    return Boolean(res?.success);
  } catch (error) {
    normalizeDbError(error);
  }
}
