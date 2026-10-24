-- 0136_auths_isolations.sql
-- Logical auth isolation for drakos and mentorias in shared D1.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS drakos_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS drakos_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'password',
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  algo TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES drakos_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drakos_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES drakos_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mentorias_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS mentorias_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'password',
  hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL,
  algo TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES mentorias_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mentorias_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (user_id) REFERENCES mentorias_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_drakos_credentials_user_id ON drakos_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_drakos_sessions_tenant_id ON drakos_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drakos_sessions_user_id ON drakos_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mentorias_credentials_user_id ON mentorias_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_mentorias_sessions_tenant_id ON mentorias_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentorias_sessions_user_id ON mentorias_sessions(user_id);
