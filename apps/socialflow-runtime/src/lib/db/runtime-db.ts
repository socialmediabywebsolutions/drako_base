import { getSocialFlowRuntimeEnv } from "../runtime-env";
import { logRuntimeEvent, runtimeJson } from "../runtime-observability";

export type DatabaseUnavailableReason = "binding-missing" | "migrations-missing" | "table-missing";

export class DatabaseUnavailableError extends Error {
  constructor(public reason: DatabaseUnavailableReason, message?: string) {
    super(message ?? reason);
    this.name = "DatabaseUnavailableError";
  }
}

function normalizeDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/no such table/i.test(message)) {
    throw new DatabaseUnavailableError("table-missing", message);
  }
  if (/no such column/i.test(message)) {
    throw new DatabaseUnavailableError("migrations-missing", message);
  }
  throw error instanceof Error ? error : new Error(message);
}

export function ensureDracoDb(): D1Database {
  const db = getSocialFlowRuntimeEnv()?.DRACO_DB;
  if (!db) {
    throw new DatabaseUnavailableError("binding-missing", "DRACO_DB binding is missing in the SocialFlow runtime.");
  }
  return db;
}

export function ensureSocialDb(): D1Database {
  const db = getSocialFlowRuntimeEnv()?.SOCIAL_DB;
  if (!db) {
    throw new DatabaseUnavailableError("binding-missing", "SOCIAL_DB binding is missing in the SocialFlow runtime.");
  }
  return db;
}

export function ensureSocialFlowAuthDb(): D1Database {
  const db = getSocialFlowRuntimeEnv()?.SOCIALFLOW_AUTHS_DB;
  if (!db) {
    throw new DatabaseUnavailableError("binding-missing", "SOCIALFLOW_AUTHS_DB binding is missing in the SocialFlow runtime.");
  }
  return db;
}

export async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T[]> {
  try {
    const stmt = db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.all<T>();
    return result.results ?? [];
  } catch (error) {
    normalizeDbError(error);
  }
}

export async function queryOne<T>(db: D1Database, sql: string, ...params: unknown[]): Promise<T | null> {
  const rows = await queryAll<T>(db, sql, ...params);
  return rows[0] ?? null;
}

export async function run(db: D1Database, sql: string, ...params: unknown[]): Promise<boolean> {
  try {
    const stmt = db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    const result = await bound.run();
    return Boolean(result?.success);
  } catch (error) {
    normalizeDbError(error);
  }
}

export async function runDetailed(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<{ success?: boolean; meta?: Record<string, unknown> | undefined }> {
  try {
    const stmt = db.prepare(sql);
    const bound = params.length > 0 ? stmt.bind(...params) : stmt;
    return await bound.run() as { success?: boolean; meta?: Record<string, unknown> | undefined };
  } catch (error) {
    normalizeDbError(error);
  }
}

export function respondDatabaseError(error: unknown, request?: Request | Headers | null): Response | null {
  if (!(error instanceof DatabaseUnavailableError)) {
    return null;
  }

  logRuntimeEvent("error", "db_unavailable", {
    correlationId: request instanceof Request ? request.headers.get("x-correlation-id") : request?.get("x-correlation-id") ?? null,
    reason: error.reason,
    message: error.message,
  });

  const message =
    error.reason === "binding-missing"
      ? "Required database binding is missing in the SocialFlow runtime."
      : error.reason === "migrations-missing"
        ? "SocialFlow runtime database migrations are missing."
        : "Required SocialFlow runtime table is missing.";

  return runtimeJson(
    {
      ok: false,
      error: "SOCIALFLOW_RUNTIME_DB_UNAVAILABLE",
      reason: error.reason,
      message,
    },
    { status: 503 },
    { request },
  );
}
