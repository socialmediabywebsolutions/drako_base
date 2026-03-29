ALTER TABLE student_profiles ADD COLUMN user_id TEXT;
ALTER TABLE parent_accounts ADD COLUMN user_id TEXT;
ALTER TABLE parent_accounts ADD COLUMN relationship_label TEXT;
ALTER TABLE parent_accounts ADD COLUMN notification_preferences_json TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_student_profiles_tenant_user ON student_profiles(tenant_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_accounts_tenant_user ON parent_accounts(tenant_id, user_id);
