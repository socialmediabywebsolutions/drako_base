import { execFileSync } from "node:child_process";
import process from "node:process";

const rootConfig = "wrangler.jsonc";
const rootDb = "drako_db_local";
const workerDir = "workers/mentorias";
const localMigrations = [
  "workers/mentorias/migrations/0001_local_mentoria_schema_bootstrap.sql",
  "workers/mentorias/migrations/0002_local_runtime_metrics.sql",
  "workers/mentorias/migrations/0003_local_resilience_feedback.sql",
];
const alignWorker = process.argv.includes("--align-worker");
const applyRootMigrations = process.argv.includes("--with-root-migrations");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd ?? process.cwd(),
    env: process.env,
  });
}

function queryJson(command, args, options = {}) {
  const output = execFileSync(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    cwd: options.cwd ?? process.cwd(),
    env: process.env,
    encoding: "utf8",
  });
  return JSON.parse(output);
}

function runSql(sql) {
  run("pnpm", [
    "wrangler",
    "d1",
    "execute",
    rootDb,
    "--local",
    "--config",
    rootConfig,
    "--command",
    sql,
  ]);
}

function columnExists(tableName, columnName) {
  const result = queryJson("pnpm", [
    "wrangler",
    "d1",
    "execute",
    rootDb,
    "--local",
    "--config",
    rootConfig,
    "--command",
    `PRAGMA table_info('${tableName}');`,
    "--json",
  ]);
  const columns = result?.[0]?.results ?? [];
  return columns.some((column) => column.name === columnName);
}

function ensureColumn(tableName, columnName, definition) {
  if (!columnExists(tableName, columnName)) {
    runSql(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function ensureMentoriaRuntimeCompatibility() {
  runSql(`CREATE TABLE IF NOT EXISTS saas_subscriptions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    plan_code TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT,
    UNIQUE(tenant_id, saas_slug)
  );`);
  ensureColumn("saas_subscriptions", "stripe_price_id", "TEXT");
  ensureColumn("saas_subscriptions", "current_period_start", "TEXT");
  ensureColumn("saas_subscriptions", "cancel_at_period_end", "INTEGER DEFAULT 0");

  ensureColumn("saas_domains", "verification_status", "TEXT");
  ensureColumn("saas_domains", "verification_reason", "TEXT");
  ensureColumn("saas_domains", "retry_count", "INTEGER NOT NULL DEFAULT 0");
  runSql(`CREATE TABLE IF NOT EXISTS acquisition_posts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    clicks INTEGER NOT NULL DEFAULT 0,
    signups INTEGER NOT NULL DEFAULT 0,
    trial_starts INTEGER NOT NULL DEFAULT 0,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );`);
  runSql("CREATE INDEX IF NOT EXISTS idx_acquisition_posts_tenant_created ON acquisition_posts(tenant_id, created_at DESC);");
  runSql("CREATE INDEX IF NOT EXISTS idx_acquisition_posts_channel ON acquisition_posts(channel, published_at DESC);");
}

function assertSchema() {
  const trials = queryJson("pnpm", [
    "wrangler",
    "d1",
    "execute",
    rootDb,
    "--local",
    "--config",
    rootConfig,
    "--command",
    "SELECT name FROM sqlite_master WHERE type='table' AND name='student_trials';",
    "--json",
  ]);
  const studyPlan = queryJson("pnpm", [
    "wrangler",
    "d1",
    "execute",
    rootDb,
    "--local",
    "--config",
    rootConfig,
    "--command",
    "PRAGMA table_info('mentoria_study_plans');",
    "--json",
  ]);
  const columns = studyPlan?.[0]?.results ?? [];
  const hasTrials = (trials?.[0]?.results ?? []).some((row) => row.name === "student_trials");
  const hasWeekEnd = columns.some((column) => column.name === "week_end");
  if (!hasTrials) {
    throw new Error("BOOTSTRAP_FAILED: student_trials missing in drako_db_local");
  }
  if (!hasWeekEnd) {
    throw new Error("BOOTSTRAP_FAILED: mentoria_study_plans.week_end missing in drako_db_local");
  }
}
if (applyRootMigrations) {
  run("pnpm", ["wrangler", "d1", "migrations", "apply", "DRACO_DB", "--local", "--config", rootConfig]);
}
for (const file of localMigrations) {
  run("pnpm", ["wrangler", "d1", "execute", rootDb, "--local", "--config", rootConfig, "--file", file]);
}
ensureMentoriaRuntimeCompatibility();
if (alignWorker) {
  run("pnpm", ["migrations:local"], { cwd: workerDir });
}
assertSchema();
console.log(
  `MENTORIA_LOCAL_BOOTSTRAP_OK root_db=${rootDb} align_worker=${alignWorker ? "1" : "0"} with_root_migrations=${applyRootMigrations ? "1" : "0"}`,
);
