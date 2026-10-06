-- Mentoría — Resiliencia, progresión, exámenes y tablas auxiliares
-- Cierra el gap de 15 tablas referenciadas en código pero ausentes en migrations.

-- ─── Students (perfil estudiante extendido) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_students (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  name                TEXT NOT NULL,
  age                 INTEGER,
  school_year         TEXT,
  family_id           TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_students_tenant
  ON mentoria_students(tenant_id);

-- ─── Trials (períodos de prueba por alumno) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_trials (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_profile_id  TEXT NOT NULL,
  started_at          TEXT NOT NULL,
  expires_at          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'expired', 'converted')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_trials_tenant_student
  ON mentoria_trials(tenant_id, student_profile_id);

-- ─── Student Trials (tabla alternativa de trials con conversión) ───────────────
CREATE TABLE IF NOT EXISTS student_trials (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_profile_id  TEXT NOT NULL,
  started_at          TEXT NOT NULL,
  expires_at          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active',
  converted_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, student_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_student_trials_tenant_student
  ON student_trials(tenant_id, student_profile_id);

-- ─── Billing Cycles (ciclos de facturación por tenant) ───────────────────────
CREATE TABLE IF NOT EXISTS mentoria_billing_cycles (
  tenant_id           TEXT PRIMARY KEY,
  cycle_start         TEXT NOT NULL,
  cycle_end           TEXT NOT NULL,
  included_sessions   INTEGER NOT NULL DEFAULT 10,
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ─── SaaS Instances (instancias de productos Drako) ──────────────────────────
CREATE TABLE IF NOT EXISTS saas_instances (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  name                      TEXT NOT NULL,
  slug                      TEXT NOT NULL UNIQUE,
  status                    TEXT NOT NULL DEFAULT 'provisioning' CHECK(status IN ('provisioning','trial_active','active','suspended','cancelled')),
  blueprint_snapshot        TEXT,
  trial_started_at          TEXT,
  trial_ends_at             TEXT,
  plan_tier                 TEXT NOT NULL DEFAULT 'trial',
  plan_status               TEXT NOT NULL DEFAULT 'active',
  total_cost_ai             REAL NOT NULL DEFAULT 0.0,
  total_cost_infra          REAL NOT NULL DEFAULT 0.0,
  estimated_value_generated REAL NOT NULL DEFAULT 0.0,
  trial_domain              TEXT NOT NULL DEFAULT '',
  custom_domain             TEXT,
  domain_status             TEXT NOT NULL DEFAULT 'none' CHECK(domain_status IN ('none','locked','pending','verifying','verified','active','failed','pending_manual')),
  domain_verify_token       TEXT,
  domain_last_checked_at    TEXT,
  domain_error              TEXT,
  domain_provider           TEXT NOT NULL DEFAULT 'cloudflare',
  billing_cycle_start       TEXT,
  billing_cycle_end         TEXT,
  billing_anchor_day        INTEGER NOT NULL DEFAULT 1,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_instances_tenant
  ON saas_instances(tenant_id);

-- ─── Notification Jobs (cola de notificaciones con reintentos) ───────────────
CREATE TABLE IF NOT EXISTS mentoria_notification_jobs (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  student_id      TEXT NOT NULL,
  parent_phone    TEXT NOT NULL,
  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','delivered','failed','abandoned')),
  retry_count     INTEGER NOT NULL DEFAULT 0,
  max_retries     INTEGER NOT NULL DEFAULT 3,
  next_retry_at   TEXT,
  last_error      TEXT,
  message_id      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  delivered_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_tenant_status
  ON mentoria_notification_jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_next_retry
  ON mentoria_notification_jobs(next_retry_at);

-- ─── Notification Log (historial de envíos) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_notification_log (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  session_id      TEXT NOT NULL,
  student_id      TEXT NOT NULL,
  parent_phone    TEXT NOT NULL,
  message_id      TEXT,
  error_message   TEXT,
  status          TEXT NOT NULL CHECK(status IN ('success','failed')),
  created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_log_tenant_session
  ON mentoria_notification_log(tenant_id, session_id);

-- ─── Publish Jobs (jobs de publicación en redes sociales) ────────────────────
CREATE TABLE IF NOT EXISTS mentoria_publish_jobs (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  post_id         TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK(channel IN ('linkedin','instagram','tiktok')),
  content         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending_publish' CHECK(status IN ('pending_publish','publishing','pending_confirmation','confirmed','failed','abandoned')),
  external_id     TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TEXT NOT NULL,
  published_at    TEXT,
  confirmed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_tenant_status
  ON mentoria_publish_jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_publish_jobs_external_id
  ON mentoria_publish_jobs(external_id);

-- ─── Idempotency Keys (prevención de duplicados) ─────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_idempotency_keys (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  idempotency_key   TEXT NOT NULL,
  operation_type    TEXT NOT NULL,
  result_json       TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  UNIQUE(tenant_id, idempotency_key, operation_type)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_tenant
  ON mentoria_idempotency_keys(tenant_id);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created_at
  ON mentoria_idempotency_keys(created_at);

-- ─── Student Progression (sistema de XP y niveles) ───────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_student_progression (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  student_id          TEXT NOT NULL UNIQUE,
  xp_total            INTEGER NOT NULL DEFAULT 0,
  xp_this_week        INTEGER NOT NULL DEFAULT 0,
  level               INTEGER NOT NULL DEFAULT 1,
  level_name          TEXT NOT NULL DEFAULT 'Explorador',
  streak_days         INTEGER NOT NULL DEFAULT 0,
  streak_best         INTEGER NOT NULL DEFAULT 0,
  last_activity_date  TEXT,
  weekly_reset_date   TEXT,
  sessions_completed  INTEGER NOT NULL DEFAULT 0,
  sessions_this_week  INTEGER NOT NULL DEFAULT 0,
  exams_completed     INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_student_progression_tenant
  ON mentoria_student_progression(tenant_id);

-- ─── Student Achievements (logros desbloqueados) ─────────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_student_achievements (
  id                      TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL,
  student_id              TEXT NOT NULL,
  achievement_id          TEXT NOT NULL,
  achievement_label       TEXT NOT NULL,
  achievement_description TEXT NOT NULL,
  achievement_icon        TEXT NOT NULL DEFAULT '⭐',
  xp_awarded              INTEGER NOT NULL DEFAULT 0,
  unlocked_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(student_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_student_achievements_student
  ON mentoria_student_achievements(tenant_id, student_id);

-- ─── XP Events (historial de ganancia/pérdida de XP) ─────────────────────────
CREATE TABLE IF NOT EXISTS mentoria_xp_events (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  student_id  TEXT NOT NULL,
  session_id  TEXT,
  reason      TEXT NOT NULL CHECK(reason IN ('session_complete','exam_prep','streak_bonus','achievement')),
  xp_delta    INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_xp_events_student
  ON mentoria_xp_events(tenant_id, student_id, created_at DESC);

-- ─── Declared Exams (exámenes declarados por el alumno) ──────────────────────
CREATE TABLE IF NOT EXISTS mentoria_declared_exams (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  student_id       TEXT NOT NULL,
  subject_id       TEXT NOT NULL,
  subject_name     TEXT NOT NULL,
  exam_date        TEXT NOT NULL,
  exam_label       TEXT,
  difficulty       TEXT NOT NULL DEFAULT 'medium' CHECK(difficulty IN ('easy','medium','hard')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
  sessions_planned INTEGER NOT NULL DEFAULT 0,
  sessions_done    INTEGER NOT NULL DEFAULT 0,
  score_after      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_declared_exams_student
  ON mentoria_declared_exams(tenant_id, student_id, exam_date DESC);

CREATE INDEX IF NOT EXISTS idx_declared_exams_status
  ON mentoria_declared_exams(tenant_id, status, exam_date ASC);

-- ─── Exam Simulations (resultados de simulacros de examen) ───────────────────
CREATE TABLE IF NOT EXISTS mentoria_exam_simulations (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  student_id        TEXT NOT NULL,
  declared_exam_id  TEXT NOT NULL,
  subject_id        TEXT NOT NULL,
  duration_seconds  INTEGER NOT NULL,
  score_percent     INTEGER CHECK(score_percent BETWEEN 0 AND 100),
  questions_count   INTEGER NOT NULL DEFAULT 0,
  correct_count     INTEGER,
  topics_covered    TEXT,
  weak_topics       TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_exam_simulations_exam
  ON mentoria_exam_simulations(tenant_id, declared_exam_id);

-- ─── Session Summaries (resúmenes de sesión para padres) ─────────────────────
CREATE TABLE IF NOT EXISTS mentoria_session_summaries (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  student_id       TEXT NOT NULL,
  subject_slug     TEXT NOT NULL,
  subject_name     TEXT NOT NULL,
  session_date     TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  headline         TEXT NOT NULL,
  points_json      TEXT NOT NULL DEFAULT '[]',
  closing_tone     TEXT NOT NULL DEFAULT 'neutral' CHECK(closing_tone IN ('positive','neutral','needs_encouragement')),
  closing_message  TEXT NOT NULL,
  parent_note      TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_student
  ON mentoria_session_summaries(tenant_id, student_id, session_date DESC);
