import { EXPECTED_MIGRATIONS } from "../src/lib/db/expected-migrations";
import { getDbHealthSnapshot, type DbDriftFinding } from "../src/lib/db/health";

type MockDb = {
  migrations: string[];
  tables: Record<string, string[]>;
};

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createMockQuery(db: MockDb) {
  return async (sql: string, ...params: unknown[]) => {
    if (sql.includes("sqlite_master")) {
      const table = params[0] as string;
      return db.tables[table] ? [{ name: table }] : [];
    }
    if (sql.startsWith("PRAGMA table_info")) {
      const tableName = sql.match(/PRAGMA table_info\('(.+)'\)/)?.[1];
      if (!tableName) return [];
      return (db.tables[tableName] ?? []).map((name) => ({ name }));
    }
    if (sql.includes("FROM drako_migrations")) {
      return db.migrations.map((id) => ({ id }));
    }
    return [];
  };
}

function applyActionQueueDedupe(findings: DbDriftFinding[], actions: Map<string, string>) {
  for (const finding of findings) {
    const key = `db:drift:${finding.table}`;
    if (!actions.has(key)) {
      actions.set(key, finding.message);
    }
  }
}

async function testMissingMigrations() {
  const db: MockDb = {
    migrations: ["0045_drako_empire_runtime_core", "0046_drako_empire_runtime_constraints"],
    tables: {
      drako_migrations: ["id", "applied_at", "checksum", "source"],
      campamento_events: ["id"],
      campamento_event_rollups_daily: ["day"],
      campamento_actions: ["action_key", "status", "seen_count"],
      saas_domains: ["status", "verification_status", "verification_reason"],
      saas_stripe_mapping: ["id"],
      stripe_webhook_events: ["stripe_event_id"],
      ai_usage_counters: ["key"],
      ai_rate_limit_buckets: ["key"],
      ai_circuit_breakers: ["key"],
    },
  };
  const snapshot = await getDbHealthSnapshot({ query: createMockQuery(db) });
  assert(snapshot.status === "CRITICAL", "missing migrations should be CRITICAL");
  assert(snapshot.missingMigrations.length === EXPECTED_MIGRATIONS.length - db.migrations.length, "missing count mismatch");
}

async function testDriftDedupe() {
  const db: MockDb = {
    migrations: [...EXPECTED_MIGRATIONS],
    tables: {
      drako_migrations: ["id", "applied_at", "checksum", "source"],
      campamento_events: ["id"],
      campamento_event_rollups_daily: ["day"],
      campamento_actions: ["action_key", "status", "seen_count"],
      saas_domains: ["status", "verification_status"],
      saas_stripe_mapping: ["id"],
      stripe_webhook_events: ["stripe_event_id"],
      ai_usage_counters: ["key"],
      ai_rate_limit_buckets: ["key"],
      ai_circuit_breakers: ["key"],
    },
  };
  const snapshot = await getDbHealthSnapshot({ query: createMockQuery(db) });
  assert(snapshot.driftFindings.length > 0, "drift findings should be present");
  const actions = new Map<string, string>();
  applyActionQueueDedupe(snapshot.driftFindings, actions);
  applyActionQueueDedupe(snapshot.driftFindings, actions);
  assert(actions.size === 1, "action queue dedupe should keep single entry per table");
}

async function main() {
  await testMissingMigrations();
  await testDriftDedupe();
  console.log("DB health fixtures: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
