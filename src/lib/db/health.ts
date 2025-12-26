import { queryAll } from "@/lib/db";
import { EXPECTED_MIGRATIONS } from "@/lib/db/expected-migrations";

type DbHealthStatus = "OK" | "WARNING" | "CRITICAL";

export type DbDriftFinding = {
  type: "TABLE_MISSING" | "COLUMN_MISSING";
  table: string;
  column?: string;
  severity: "WARNING" | "CRITICAL";
  message: string;
};

export type DbHealthSnapshot = {
  status: DbHealthStatus;
  appliedMigrations: { count: number; ids: string[] };
  missingMigrations: string[];
  driftFindings: DbDriftFinding[];
};

type DbQuery = (sql: string, ...params: unknown[]) => Promise<unknown[]>;

async function defaultQuery(sql: string, ...params: unknown[]) {
  return queryAll<Record<string, unknown>>(sql, ...params);
}

async function tableExists(query: DbQuery, table: string): Promise<boolean> {
  const rows = (await query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1",
    table,
  )) as Array<{ name?: string }>;
  return rows.some((row) => row.name === table);
}

async function listTableColumns(query: DbQuery, table: string): Promise<Set<string>> {
  const rows = (await query(`PRAGMA table_info('${table}')`)) as Array<{ name?: string }>;
  return new Set(rows.map((row) => row.name).filter((name): name is string => Boolean(name)));
}

function computeStatus(missingMigrations: string[], driftFindings: DbDriftFinding[]): DbHealthStatus {
  if (missingMigrations.length > 0) return "CRITICAL";
  if (driftFindings.some((finding) => finding.severity === "CRITICAL")) return "CRITICAL";
  if (driftFindings.length > 0) return "WARNING";
  return "OK";
}

export async function getDbHealthSnapshot(params?: { query?: DbQuery }): Promise<DbHealthSnapshot> {
  const query = params?.query ?? defaultQuery;
  const driftFindings: DbDriftFinding[] = [];

  const migrationsTableExists = await tableExists(query, "drako_migrations");
  let appliedIds: string[] = [];
  if (migrationsTableExists) {
    const rows = (await query("SELECT id FROM drako_migrations ORDER BY applied_at ASC")) as Array<{ id?: string }>;
    appliedIds = rows.map((row) => row.id).filter((id): id is string => Boolean(id));
  } else {
    driftFindings.push({
      type: "TABLE_MISSING",
      table: "drako_migrations",
      severity: "CRITICAL",
      message: "Missing drako_migrations table.",
    });
  }

  const missingMigrations = EXPECTED_MIGRATIONS.filter((id) => !appliedIds.includes(id));

  const requiredTables = [
    "campamento_events",
    "campamento_event_rollups_daily",
    "campamento_actions",
    "saas_domains",
    "saas_stripe_mapping",
    "stripe_webhook_events",
    "ai_usage_counters",
    "ai_rate_limit_buckets",
    "ai_circuit_breakers",
  ];

  for (const table of requiredTables) {
    if (!(await tableExists(query, table))) {
      driftFindings.push({
        type: "TABLE_MISSING",
        table,
        severity: "CRITICAL",
        message: `Missing table: ${table}.`,
      });
    }
  }

  const columnChecks: Array<{ table: string; columns: string[] }> = [
    { table: "saas_domains", columns: ["status", "verification_status", "verification_reason"] },
    { table: "campamento_event_rollups_daily", columns: ["day"] },
    { table: "campamento_actions", columns: ["action_key", "status", "seen_count"] },
  ];

  for (const check of columnChecks) {
    if (!(await tableExists(query, check.table))) {
      continue;
    }
    const columns = await listTableColumns(query, check.table);
    for (const column of check.columns) {
      if (!columns.has(column)) {
        driftFindings.push({
          type: "COLUMN_MISSING",
          table: check.table,
          column,
          severity: "CRITICAL",
          message: `Missing column ${check.table}.${column}.`,
        });
      }
    }
  }

  return {
    status: computeStatus(missingMigrations, driftFindings),
    appliedMigrations: { count: appliedIds.length, ids: appliedIds },
    missingMigrations,
    driftFindings,
  };
}
