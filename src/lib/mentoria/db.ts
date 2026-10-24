import { env } from "@/lib/cf";
import { getMentoriaDb } from "@/lib/mentoria/get-mentoria-db";

export type DatabaseUnavailableReason = "binding-missing" | "migrations-missing" | "table-missing";

export class DatabaseUnavailableError extends Error {
  constructor(public reason: DatabaseUnavailableReason, message?: string) {
    super(message ?? reason);
    this.name = "DatabaseUnavailableError";
  }
}

export function isDatabaseAvailable(): boolean {
  const bindings = env();
  if (bindings?.MENTORIA_DB) {
    return true;
  }
  return Boolean((globalThis as { __TEST_DB__?: D1Database }).__TEST_DB__);
}

export function getDb(): D1Database {
  try {
    return getMentoriaDb();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseUnavailableError("binding-missing", message);
  }
}

export async function withDb<T>(fn: (db: D1Database) => Promise<T>): Promise<T> {
  return fn(getDb());
}

export function ensureDatabase(): D1Database {
  return getDb();
}

function normalizeDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/no such table/i.test(message)) {
    console.error("MENTORIA_DB_TABLE_MISSING", message);
    throw new DatabaseUnavailableError("table-missing", message);
  }
  if (/no such column/i.test(message)) {
    console.error("MENTORIA_DB_MIGRATION_MISSING", message);
    throw new DatabaseUnavailableError("migrations-missing", message);
  }
  throw error instanceof Error ? error : new Error(message);
}

export async function queryAll<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  try {
    const db = getDb();
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
  return rows[0] ?? null;
}

export async function run(sql: string, ...params: unknown[]): Promise<boolean> {
  try {
    const db = getDb();
    const stmt = db.prepare(sql);
    const bound = params.length ? stmt.bind(...params) : stmt;
    const res = await bound.run();
    return Boolean(res?.success);
  } catch (error) {
    normalizeDbError(error);
  }
}
