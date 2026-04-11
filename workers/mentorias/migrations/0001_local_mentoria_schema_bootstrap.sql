CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  full_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  school_year TEXT NOT NULL,
  learning_goals_json TEXT NOT NULL DEFAULT '[]',
  base_emotional_state TEXT NOT NULL DEFAULT 'steady',
  emotional_baseline_json TEXT NOT NULL DEFAULT '{"frustration":"medium","motivation":"medium","concentration":"medium"}',
  learning_preference TEXT NOT NULL DEFAULT 'step_by_step',
  preferred_study_minutes INTEGER NOT NULL DEFAULT 25,
  strengths_json TEXT NOT NULL DEFAULT '[]',
  support_notes TEXT,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_tenant
  ON student_profiles(tenant_id);

CREATE INDEX IF NOT EXISTS idx_student_profiles_tenant_user
  ON student_profiles(tenant_id, user_id);

CREATE TABLE IF NOT EXISTS parent_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  student_profile_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  relation TEXT NOT NULL,
  relationship_label TEXT,
  notification_preferences_json TEXT NOT NULL DEFAULT '[]',
  daily_study_minutes INTEGER NOT NULL DEFAULT 0,
  supervision_level TEXT NOT NULL DEFAULT 'balanced',
  can_view_full_progress INTEGER NOT NULL DEFAULT 1,
  can_manage_schedule INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_parent_accounts_tenant_student
  ON parent_accounts(tenant_id, student_profile_id);

CREATE TABLE IF NOT EXISTS mentoria_student_subjects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  initial_level TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_subjects_unique
  ON mentoria_student_subjects(tenant_id, student_profile_id, subject_id);

CREATE TABLE IF NOT EXISTS mentoria_study_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  goals_summary TEXT,
  blocks_json TEXT NOT NULL DEFAULT '[]',
  generated_by TEXT NOT NULL DEFAULT 'planner-agent',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_study_plans_tenant_student
  ON mentoria_study_plans(tenant_id, student_profile_id, week_start);

CREATE TABLE IF NOT EXISTS mentoria_progress (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  mastery_score REAL NOT NULL DEFAULT 0,
  confidence_score REAL NOT NULL DEFAULT 50,
  streak_days INTEGER NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  exercises_completed INTEGER NOT NULL DEFAULT 0,
  weak_topics_json TEXT NOT NULL DEFAULT '[]',
  strong_topics_json TEXT NOT NULL DEFAULT '[]',
  last_activity_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_progress_tenant_student_subject
  ON mentoria_progress(tenant_id, student_profile_id, subject_id);

CREATE TABLE IF NOT EXISTS mentoria_exercises (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  session_id TEXT,
  prompt TEXT NOT NULL,
  expected_competency TEXT NOT NULL,
  hints_json TEXT NOT NULL DEFAULT '[]',
  answer_format TEXT NOT NULL DEFAULT 'respuesta abierta corta',
  student_answer TEXT,
  correction_feedback TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  difficulty_level TEXT NOT NULL,
  score REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_exercises_tenant_student
  ON mentoria_exercises(tenant_id, student_profile_id, created_at);

CREATE TABLE IF NOT EXISTS mentoria_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  cost_est_major INTEGER NOT NULL DEFAULT 0,
  price_charged_major INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  transcript_json TEXT NOT NULL DEFAULT '[]',
  emotional_state TEXT,
  tutor_summary TEXT,
  recommended_next_step TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT,
  billed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_tenant
  ON mentoria_sessions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_mentoria_sessions_student
  ON mentoria_sessions(tenant_id, student_profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mentoria_focus_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  subject_id TEXT,
  study_plan_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_minutes INTEGER NOT NULL,
  distractions_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_focus_sessions_tenant_student
  ON mentoria_focus_sessions(tenant_id, student_profile_id, started_at);

CREATE TABLE IF NOT EXISTS mentoria_session_state (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  transcript_json TEXT NOT NULL DEFAULT '[]',
  emotional_state TEXT NOT NULL DEFAULT 'neutral',
  last_activity_at TEXT NOT NULL,
  ai_tokens_used INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_mentoria_session_state_active
  ON mentoria_session_state(tenant_id, student_profile_id, status, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS mentoria_student_evolution (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  strengths_json TEXT NOT NULL DEFAULT '[]',
  weaknesses_json TEXT NOT NULL DEFAULT '[]',
  frustration_level REAL NOT NULL DEFAULT 0.35,
  consistency_score REAL NOT NULL DEFAULT 0.5,
  average_response_time REAL NOT NULL DEFAULT 0,
  last_sessions INTEGER NOT NULL DEFAULT 0,
  common_mistakes_json TEXT NOT NULL DEFAULT '[]',
  progression_velocity REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_evolution_tenant_student
  ON mentoria_student_evolution(tenant_id, student_profile_id);

CREATE TABLE IF NOT EXISTS mentoria_interventions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  intervention_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  recommendations_json TEXT NOT NULL DEFAULT '[]',
  channels_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  resolved_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_interventions_active_unique
  ON mentoria_interventions(tenant_id, student_profile_id, intervention_type, status);

CREATE TABLE IF NOT EXISTS mentoria_motivation_states (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  streak INTEGER NOT NULL DEFAULT 0,
  last_activity_at TEXT NOT NULL,
  effort_score REAL NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  achievements_json TEXT NOT NULL DEFAULT '[]',
  motivation_profile TEXT NOT NULL DEFAULT 'stable',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_motivation_tenant_student
  ON mentoria_motivation_states(tenant_id, student_profile_id);

CREATE TABLE IF NOT EXISTS mentoria_daily_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  plan_date TEXT NOT NULL,
  recommended_duration INTEGER NOT NULL,
  tasks_json TEXT NOT NULL,
  completed_task_ids_json TEXT NOT NULL DEFAULT '[]',
  priority TEXT NOT NULL,
  adaptation_reason TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_daily_plans_unique
  ON mentoria_daily_plans(tenant_id, student_profile_id, plan_date);

CREATE TABLE IF NOT EXISTS mentoria_referral_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  total_invites INTEGER NOT NULL DEFAULT 0,
  registered_invites INTEGER NOT NULL DEFAULT 0,
  converted_invites INTEGER NOT NULL DEFAULT 0,
  premium_access_until TEXT,
  reward_points_earned INTEGER NOT NULL DEFAULT 0,
  feature_unlocks_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_referral_profiles_student
  ON mentoria_referral_profiles(tenant_id, student_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_referral_profiles_code
  ON mentoria_referral_profiles(tenant_id, referral_code);

CREATE TABLE IF NOT EXISTS mentoria_referrals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  inviter_student_profile_id TEXT NOT NULL,
  invitee_student_profile_id TEXT,
  invited_email TEXT,
  referral_code TEXT NOT NULL,
  invite_token TEXT,
  status TEXT NOT NULL,
  reward_premium_days INTEGER NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,
  reward_features_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  registered_at TEXT,
  converted_at TEXT,
  rewarded_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_mentoria_referrals_inviter
  ON mentoria_referrals(tenant_id, inviter_student_profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_referrals_invite_token
  ON mentoria_referrals(tenant_id, invite_token);

CREATE TABLE IF NOT EXISTS mentoria_progress_shares (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  share_code TEXT NOT NULL,
  share_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_progress_shares_code
  ON mentoria_progress_shares(tenant_id, share_code);

CREATE INDEX IF NOT EXISTS idx_mentoria_progress_shares_student
  ON mentoria_progress_shares(tenant_id, student_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_trials_status
  ON student_trials(tenant_id, student_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_student_trials_expiry
  ON student_trials(expires_at, status);
