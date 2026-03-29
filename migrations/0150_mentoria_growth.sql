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
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_referral_profiles_student
  ON mentoria_referral_profiles (tenant_id, student_profile_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_referral_profiles_code
  ON mentoria_referral_profiles (tenant_id, referral_code);

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
  created_at TEXT NOT NULL,
  registered_at TEXT,
  converted_at TEXT,
  rewarded_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mentoria_referrals_inviter
  ON mentoria_referrals (tenant_id, inviter_student_profile_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_referrals_invite_token
  ON mentoria_referrals (tenant_id, invite_token);

CREATE TABLE IF NOT EXISTS mentoria_progress_shares (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  share_code TEXT NOT NULL,
  share_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  summary_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_progress_shares_code
  ON mentoria_progress_shares (tenant_id, share_code);

CREATE INDEX IF NOT EXISTS idx_mentoria_progress_shares_student
  ON mentoria_progress_shares (tenant_id, student_profile_id, created_at DESC);
