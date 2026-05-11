import { execFileSync } from "node:child_process";
import process from "node:process";

const rootConfig = "wrangler.jsonc";
const rootBinding = "DRACO_DB";
const workerDir = "workers/mentorias";
const workerConfig = "workers/mentorias/wrangler.workers.toml";
const productBinding = "MENTORIA_DB";
const authBinding = "MENTORIAS_AUTHS_DB";

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

function runWorkerSql(binding, sql) {
  run("pnpm", [
    "wrangler",
    "d1",
    "execute",
    binding,
    "--local",
    "--config",
    workerConfig,
    "--command",
    sql,
  ]);
}

function queryWorkerJson(binding, sql) {
  return queryJson("pnpm", [
    "wrangler",
    "d1",
    "execute",
    binding,
    "--local",
    "--config",
    workerConfig,
    "--command",
    sql,
    "--json",
  ]);
}

function workerColumnExists(tableName, columnName) {
  const result = queryWorkerJson(productBinding, `PRAGMA table_info('${tableName}');`);
  const columns = result?.[0]?.results ?? [];
  return columns.some((column) => column.name === columnName);
}

function ensureWorkerColumn(tableName, columnName, definition) {
  if (!workerColumnExists(tableName, columnName)) {
    runWorkerSql(productBinding, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function ensureMentoriaRuntimeCompatibility() {
  ensureWorkerColumn("student_profiles", "display_name", "TEXT");
  ensureWorkerColumn("student_profiles", "grade_level", "TEXT");
  ensureWorkerColumn("student_profiles", "goals_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureWorkerColumn("student_profiles", "emotional_baseline", "TEXT NOT NULL DEFAULT 'steady'");
  ensureWorkerColumn("student_profiles", "learning_style", "TEXT");
  ensureWorkerColumn("student_profiles", "preferred_session_minutes", "INTEGER NOT NULL DEFAULT 25");
  runWorkerSql(productBinding, `UPDATE student_profiles
    SET display_name = COALESCE(display_name, full_name, 'Alumno'),
        grade_level = COALESCE(grade_level, school_year, ''),
        goals_json = COALESCE(goals_json, learning_goals_json, '[]'),
        emotional_baseline = COALESCE(emotional_baseline, base_emotional_state, 'steady'),
        learning_style = COALESCE(learning_style, learning_preference, 'step_by_step'),
        preferred_session_minutes = COALESCE(preferred_session_minutes, preferred_study_minutes, 25)
    WHERE display_name IS NULL
       OR grade_level IS NULL
       OR goals_json IS NULL
       OR emotional_baseline IS NULL
       OR preferred_session_minutes IS NULL;`);

  ensureWorkerColumn("parent_accounts", "label", "TEXT");
  ensureWorkerColumn("parent_accounts", "display_name", "TEXT");
  ensureWorkerColumn("parent_accounts", "relationship", "TEXT");
  ensureWorkerColumn("parent_accounts", "visibility_mode", "TEXT NOT NULL DEFAULT 'balanced'");
  ensureWorkerColumn("parent_accounts", "daily_minutes_limit", "INTEGER NOT NULL DEFAULT 90");
  runWorkerSql(productBinding, `UPDATE parent_accounts
    SET label = COALESCE(label, relationship_label, relation, 'tutor'),
        display_name = COALESCE(display_name, full_name, 'Tutor'),
        relationship = COALESCE(relationship, relation, relationship_label, 'tutor'),
        visibility_mode = COALESCE(visibility_mode, 'balanced'),
        daily_minutes_limit = COALESCE(daily_minutes_limit, daily_study_minutes, 90)
    WHERE label IS NULL
       OR display_name IS NULL
       OR relationship IS NULL
       OR visibility_mode IS NULL
       OR daily_minutes_limit IS NULL;`);

  ensureWorkerColumn("mentoria_student_evolution", "subject_slug", "TEXT NOT NULL DEFAULT 'general'");
  runWorkerSql(productBinding, `UPDATE mentoria_student_evolution
    SET subject_slug = COALESCE(NULLIF(TRIM(subject_slug), ''), 'general')
    WHERE subject_slug IS NULL OR TRIM(subject_slug) = '';`);
  runWorkerSql(productBinding, "DROP INDEX IF EXISTS idx_mentoria_student_evolution_tenant_student;");
  runWorkerSql(productBinding, "CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_evolution_tenant_student_subject ON mentoria_student_evolution(tenant_id, student_profile_id, subject_slug);");

  ensureWorkerColumn("mentoria_sessions", "board_update_json", "TEXT");
  ensureWorkerColumn("guardians", "tenant_id", "TEXT");
  ensureWorkerColumn("guardians", "system_role", "TEXT");
  ensureWorkerColumn("guardians", "family_relation", "TEXT");
  runWorkerSql(productBinding, `UPDATE guardians
    SET family_relation = COALESCE(family_relation, role, 'tutor')
    WHERE family_relation IS NULL;`);
  runWorkerSql(productBinding, `UPDATE guardians
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
  runWorkerSql(productBinding, `CREATE TABLE IF NOT EXISTS guardian_student_access (
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
  runWorkerSql(productBinding, "CREATE INDEX IF NOT EXISTS idx_guardian_student_access_family_guardian ON guardian_student_access(family_id, guardian_id);");
  runWorkerSql(productBinding, "CREATE INDEX IF NOT EXISTS idx_guardian_student_access_family_student ON guardian_student_access(family_id, student_id);");
  runWorkerSql(productBinding, `CREATE TABLE IF NOT EXISTS conversation_context (
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
  runWorkerSql(productBinding, "CREATE INDEX IF NOT EXISTS idx_conversation_context_family_actor ON conversation_context(family_id, actor_type, actor_id, updated_at DESC);");
  runWorkerSql(productBinding, `INSERT OR IGNORE INTO families (id)
    SELECT DISTINCT tenant_id
    FROM student_profiles
    WHERE tenant_id IS NOT NULL;`);
  runWorkerSql(productBinding, `INSERT OR IGNORE INTO students (id, name, age, level, family_id, created_at)
    SELECT
      sp.id,
      COALESCE(sp.full_name, 'Alumno'),
      sp.age,
      sp.school_year,
      sp.tenant_id,
      COALESCE(sp.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    FROM student_profiles sp
    WHERE sp.tenant_id IS NOT NULL;`);
  runWorkerSql(productBinding, `INSERT OR IGNORE INTO guardians (id, email, name, family_id, role, tenant_id, family_relation, system_role, created_at)
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
  runWorkerSql(productBinding, `INSERT OR IGNORE INTO guardian_student_access (
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
  runWorkerSql(productBinding, `INSERT OR IGNORE INTO guardian_student_access (
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
  runWorkerSql(productBinding, `UPDATE guardian_student_access
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

  runWorkerSql(productBinding, `CREATE TABLE IF NOT EXISTS saas_subscriptions (
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
  ensureWorkerColumn("saas_subscriptions", "stripe_price_id", "TEXT");
  ensureWorkerColumn("saas_subscriptions", "current_period_start", "TEXT");
  ensureWorkerColumn("saas_subscriptions", "cancel_at_period_end", "INTEGER DEFAULT 0");

  runWorkerSql(productBinding, `CREATE TABLE IF NOT EXISTS saas_domains (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    saas_slug TEXT NOT NULL,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    provider TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );`);
  ensureWorkerColumn("saas_domains", "verification_status", "TEXT");
  ensureWorkerColumn("saas_domains", "verification_reason", "TEXT");
  ensureWorkerColumn("saas_domains", "retry_count", "INTEGER NOT NULL DEFAULT 0");
  runWorkerSql(productBinding, `CREATE TABLE IF NOT EXISTS acquisition_posts (
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
  runWorkerSql(productBinding, "CREATE INDEX IF NOT EXISTS idx_acquisition_posts_tenant_created ON acquisition_posts(tenant_id, created_at DESC);");
  runWorkerSql(productBinding, "CREATE INDEX IF NOT EXISTS idx_acquisition_posts_channel ON acquisition_posts(channel, published_at DESC);");
}

function assertSchema() {
  const trials = queryWorkerJson(productBinding, "SELECT name FROM sqlite_master WHERE type='table' AND name='student_trials';");
  const subjects = queryWorkerJson(productBinding, "SELECT name FROM sqlite_master WHERE type='table' AND name='mentoria_subjects';");
  const studyPlan = queryWorkerJson(productBinding, "PRAGMA table_info('mentoria_study_plans');");
  const columns = studyPlan?.[0]?.results ?? [];
  const requiredAcademicTables = [
    "mentoria_academic_records",
    "mentoria_academic_documents",
    "mentoria_academic_extractions",
    "mentoria_academic_analyses",
    "mentoria_subject_performance_snapshots",
  ];
  const existingAcademicTables = queryWorkerJson(
    productBinding,
    `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${requiredAcademicTables.map((table) => `'${table}'`).join(", ")});`,
  );
  const authTables = queryWorkerJson(
    authBinding,
    "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('mentorias_users', 'mentorias_credentials', 'mentorias_sessions');",
  );
  const hasTrials = (trials?.[0]?.results ?? []).some((row) => row.name === "student_trials");
  const hasSubjects = (subjects?.[0]?.results ?? []).some((row) => row.name === "mentoria_subjects");
  const hasWeekEnd = columns.some((column) => column.name === "week_end");
  const academicTableNames = new Set((existingAcademicTables?.[0]?.results ?? []).map((row) => row.name));
  const authTableNames = new Set((authTables?.[0]?.results ?? []).map((row) => row.name));

  if (!hasTrials) {
    throw new Error(`BOOTSTRAP_FAILED: student_trials missing in ${productBinding}`);
  }
  if (!hasSubjects) {
    throw new Error(`BOOTSTRAP_FAILED: mentoria_subjects missing in ${productBinding}`);
  }
  if (!hasWeekEnd) {
    throw new Error(`BOOTSTRAP_FAILED: mentoria_study_plans.week_end missing in ${productBinding}`);
  }
  for (const tableName of requiredAcademicTables) {
    if (!academicTableNames.has(tableName)) {
      throw new Error(`BOOTSTRAP_FAILED: ${tableName} missing in ${productBinding}`);
    }
  }
  for (const tableName of ["mentorias_users", "mentorias_credentials", "mentorias_sessions"]) {
    if (!authTableNames.has(tableName)) {
      throw new Error(`BOOTSTRAP_FAILED: ${tableName} missing in ${authBinding}`);
    }
  }
}

if (applyRootMigrations) {
  run("pnpm", ["wrangler", "d1", "migrations", "apply", rootBinding, "--local", "--config", rootConfig]);
}

run("node", ["scripts/local/mentoria-worker-local-migrate.mjs", "all"]);
if (alignWorker) {
  console.log(`[mentoria-local-bootstrap] worker alignment reuses ${productBinding}/${authBinding} local migrations via ${workerConfig}`);
}
ensureMentoriaRuntimeCompatibility();

assertSchema();
console.log(
  `MENTORIA_LOCAL_BOOTSTRAP_OK product_binding=${productBinding} auth_binding=${authBinding} align_worker=${alignWorker ? "1" : "0"} with_root_migrations=${applyRootMigrations ? "1" : "0"}`,
);
