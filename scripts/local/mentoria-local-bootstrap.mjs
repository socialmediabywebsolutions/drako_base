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
  ensureColumn("guardians", "system_role", "TEXT");
  ensureColumn("guardians", "family_relation", "TEXT");
  runSql(`UPDATE guardians
    SET family_relation = COALESCE(family_relation, role, 'tutor')
    WHERE family_relation IS NULL;`);
  runSql(`UPDATE guardians
    SET system_role = CASE
      WHEN id = (
        SELECT g2.id
        FROM guardians g2
        WHERE g2.family_id = guardians.family_id
        ORDER BY datetime(g2.created_at) ASC, g2.id ASC
        LIMIT 1
      ) THEN 'primary_guardian'
      ELSE 'secondary_guardian'
    END
    WHERE system_role IS NULL;`);
  runSql(`CREATE TABLE IF NOT EXISTS guardian_student_access (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    guardian_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_profile_id TEXT,
    can_view_full_progress INTEGER NOT NULL DEFAULT 1,
    can_manage_schedule INTEGER NOT NULL DEFAULT 0,
    daily_study_minutes INTEGER NOT NULL DEFAULT 0,
    supervision_level TEXT NOT NULL DEFAULT 'balanced',
    notification_preferences_json TEXT NOT NULL DEFAULT '[]',
    is_primary_contact INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(family_id, guardian_id, student_id)
  );`);
  runSql("CREATE INDEX IF NOT EXISTS idx_guardian_student_access_family_guardian ON guardian_student_access(family_id, guardian_id);");
  runSql("CREATE INDEX IF NOT EXISTS idx_guardian_student_access_family_student ON guardian_student_access(family_id, student_id);");
  runSql(`CREATE TABLE IF NOT EXISTS conversation_context (
    id TEXT PRIMARY KEY,
    family_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    channel TEXT NOT NULL,
    thread_key TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    active_student_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    resolved_by TEXT NOT NULL,
    last_explicit_switch_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE(family_id, channel, thread_key, actor_type, actor_id)
  );`);
  runSql("CREATE INDEX IF NOT EXISTS idx_conversation_context_family_actor ON conversation_context(family_id, actor_type, actor_id, updated_at DESC);");
  runSql(`INSERT OR IGNORE INTO families (id)
    SELECT DISTINCT tenant_id
    FROM student_profiles
    WHERE tenant_id IS NOT NULL;`);
  runSql(`INSERT OR IGNORE INTO students (id, name, age, level, family_id, created_at)
    SELECT
      sp.id,
      COALESCE(sp.full_name, 'Alumno'),
      sp.age,
      sp.school_year,
      sp.tenant_id,
      COALESCE(sp.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    FROM student_profiles sp
    WHERE sp.tenant_id IS NOT NULL;`);
  runSql(`INSERT OR IGNORE INTO guardians (id, email, name, family_id, role, tenant_id, family_relation, system_role, created_at)
    SELECT
      lower(hex(randomblob(16))),
      lower(pa.email),
      pa.full_name,
      pa.tenant_id,
      CASE
        WHEN lower(COALESCE(pa.relation, pa.relationship_label, 'tutor')) IN ('father', 'mother', 'tutor')
          THEN lower(COALESCE(pa.relation, pa.relationship_label, 'tutor'))
        ELSE 'tutor'
      END,
      pa.tenant_id,
      CASE
        WHEN lower(COALESCE(pa.relation, pa.relationship_label, 'tutor')) IN ('father', 'mother', 'tutor')
          THEN lower(COALESCE(pa.relation, pa.relationship_label, 'tutor'))
        ELSE 'tutor'
      END,
      'secondary_guardian',
      COALESCE(pa.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    FROM parent_accounts pa
    WHERE pa.email IS NOT NULL;`);
  runSql(`INSERT OR IGNORE INTO guardian_student_access (
      id, family_id, guardian_id, student_id, student_profile_id, can_view_full_progress,
      can_manage_schedule, daily_study_minutes, supervision_level, notification_preferences_json,
      is_primary_contact, created_at, updated_at
    )
    SELECT
      lower(hex(randomblob(16))),
      pa.tenant_id,
      g.id,
      sp.id,
      sp.id,
      COALESCE(pa.can_view_full_progress, 1),
      COALESCE(pa.can_manage_schedule, 0),
      COALESCE(pa.daily_study_minutes, 0),
      COALESCE(pa.supervision_level, 'balanced'),
      COALESCE(pa.notification_preferences_json, '[]'),
      CASE WHEN g.system_role = 'primary_guardian' THEN 1 ELSE 0 END,
      COALESCE(pa.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      COALESCE(pa.updated_at, COALESCE(pa.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')))
    FROM parent_accounts pa
    JOIN guardians g
      ON g.family_id = pa.tenant_id
     AND lower(g.email) = lower(pa.email)
    JOIN student_profiles sp
      ON sp.tenant_id = pa.tenant_id
     AND sp.id = pa.student_profile_id;`);
  runSql(`INSERT OR IGNORE INTO guardian_student_access (
      id, family_id, guardian_id, student_id, student_profile_id, can_view_full_progress,
      can_manage_schedule, daily_study_minutes, supervision_level, notification_preferences_json,
      is_primary_contact, created_at, updated_at
    )
    SELECT
      lower(hex(randomblob(16))),
      g.family_id,
      g.id,
      s.id,
      s.id,
      1,
      1,
      0,
      'balanced',
      '["progress","alerts","planner"]',
      1,
      strftime('%Y-%m-%dT%H:%M:%fZ','now'),
      strftime('%Y-%m-%dT%H:%M:%fZ','now')
    FROM guardians g
    JOIN students s
      ON s.family_id = g.family_id
    WHERE g.system_role = 'primary_guardian';`);
  runSql(`UPDATE guardian_student_access
    SET can_view_full_progress = 1,
        can_manage_schedule = 1,
        is_primary_contact = 1,
        notification_preferences_json = CASE
          WHEN notification_preferences_json IS NULL OR notification_preferences_json = '' THEN '["progress","alerts","planner"]'
          ELSE notification_preferences_json
        END,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    WHERE guardian_id IN (
      SELECT id
      FROM guardians
      WHERE system_role = 'primary_guardian'
    );`);

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
