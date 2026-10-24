-- 0137_campamento_base_workspace_core.sql
-- Campamento Base: shared SaaS foundation for tenant workspace auth, teams, billing and onboarding.

ALTER TABLE auth_users ADD COLUMN email_verified TEXT;
ALTER TABLE auth_users ADD COLUMN active_tenant_id TEXT;
ALTER TABLE auth_users ADD COLUMN password_hash TEXT;

ALTER TABLE tenants ADD COLUMN created_by TEXT;

UPDATE tenants
SET created_by = COALESCE(created_by, owner_user_id)
WHERE created_by IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_created_by ON tenants(created_by);

ALTER TABLE tenant_users ADD COLUMN user_id TEXT;
ALTER TABLE tenant_users ADD COLUMN invited_by TEXT;

UPDATE tenant_users
SET user_id = (
  SELECT auth_users.id
  FROM auth_users
  WHERE lower(auth_users.email) = lower(tenant_users.email)
  LIMIT 1
)
WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_users_tenant_user
ON tenant_users(tenant_id, user_id)
WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts(user_id);

CREATE TABLE IF NOT EXISTS auth_sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires);

CREATE TABLE IF NOT EXISTS auth_verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires TEXT NOT NULL,
  PRIMARY KEY(identifier, token)
);

CREATE TABLE IF NOT EXISTS tenant_invites (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','MEMBER')),
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  expires_at TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant_status ON tenant_invites(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_invites_email ON tenant_invites(email, status);

CREATE TABLE IF NOT EXISTS tenant_billing (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'STARTER' CHECK (plan IN ('STARTER','PRO','ENTERPRISE')),
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_billing_customer ON tenant_billing(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_billing_subscription ON tenant_billing(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS tenant_onboarding (
  tenant_id TEXT PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  step TEXT NOT NULL DEFAULT 'create_workspace' CHECK (step IN ('create_workspace','invite_team','connect_product','activate_subscription','complete')),
  completed_steps TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_tenant_onboarding_step ON tenant_onboarding(step);
