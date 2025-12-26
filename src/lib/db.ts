import { env } from "@/lib/cf";

export type DatabaseUnavailableReason = "binding-missing" | "migrations-missing";

export class DatabaseUnavailableError extends Error {
  constructor(public reason: DatabaseUnavailableReason, message?: string) {
    super(message ?? reason);
    this.name = "DatabaseUnavailableError";
  }
}

function ensureDatabase(): D1Database {
  const bindings = env();
  if (!bindings?.DRACO_DB) {
    throw new DatabaseUnavailableError("binding-missing", "DRACO_DB binding is missing");
  }
  return bindings.DRACO_DB;
}

function normalizeDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/no such table/i.test(message) || /SQLITE_ERROR/i.test(message)) {
    throw new DatabaseUnavailableError("migrations-missing", "D1 migrations missing");
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
