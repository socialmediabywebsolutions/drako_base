ALTER TABLE guardians ADD COLUMN system_role TEXT CHECK(system_role IN ('primary_guardian', 'secondary_guardian'));
ALTER TABLE guardians ADD COLUMN family_relation TEXT CHECK(family_relation IN ('father', 'mother', 'tutor'));

UPDATE guardians
SET family_relation = COALESCE(family_relation, role, 'tutor')
WHERE family_relation IS NULL;

UPDATE guardians
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
WHERE system_role IS NULL;

CREATE TABLE IF NOT EXISTS guardian_student_access (
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
);

CREATE INDEX IF NOT EXISTS idx_guardian_student_access_family_guardian
  ON guardian_student_access(family_id, guardian_id);

CREATE INDEX IF NOT EXISTS idx_guardian_student_access_family_student
  ON guardian_student_access(family_id, student_id);

CREATE TABLE IF NOT EXISTS conversation_context (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK(actor_type IN ('guardian_actor', 'student_actor')),
  actor_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp')),
  thread_key TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('family', 'student')),
  active_student_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'closed')),
  resolved_by TEXT NOT NULL CHECK(resolved_by IN ('single_access', 'explicit_switch', 'legacy_fallback')),
  last_explicit_switch_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(family_id, channel, thread_key, actor_type, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_context_family_actor
  ON conversation_context(family_id, actor_type, actor_id, updated_at DESC);

INSERT OR IGNORE INTO families (id)
SELECT DISTINCT tenant_id
FROM student_profiles
WHERE tenant_id IS NOT NULL;

INSERT OR IGNORE INTO students (id, name, age, level, family_id, created_at)
SELECT
  sp.id,
  COALESCE(sp.full_name, 'Alumno'),
  sp.age,
  sp.school_year,
  sp.tenant_id,
  COALESCE(sp.created_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
FROM student_profiles sp
WHERE sp.tenant_id IS NOT NULL;

INSERT OR IGNORE INTO guardians (id, email, name, family_id, role, tenant_id, family_relation, system_role, created_at)
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
WHERE pa.email IS NOT NULL;

INSERT OR IGNORE INTO guardian_student_access (
  id,
  family_id,
  guardian_id,
  student_id,
  student_profile_id,
  can_view_full_progress,
  can_manage_schedule,
  daily_study_minutes,
  supervision_level,
  notification_preferences_json,
  is_primary_contact,
  created_at,
  updated_at
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
 AND sp.id = pa.student_profile_id;

INSERT OR IGNORE INTO guardian_student_access (
  id,
  family_id,
  guardian_id,
  student_id,
  student_profile_id,
  can_view_full_progress,
  can_manage_schedule,
  daily_study_minutes,
  supervision_level,
  notification_preferences_json,
  is_primary_contact,
  created_at,
  updated_at
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
WHERE g.system_role = 'primary_guardian';

UPDATE guardian_student_access
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
);
