CREATE TABLE IF NOT EXISTS drako_integration_definitions (
  id TEXT PRIMARY KEY,
  integration_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('social','payments','email','crm','other')),
  auth_mode TEXT NOT NULL CHECK (auth_mode IN ('token','api_key','basic','custom')),
  enabled INTEGER NOT NULL DEFAULT 1,
  supported_operations_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_drako_integration_definitions_provider
ON drako_integration_definitions(provider, enabled);

CREATE TABLE IF NOT EXISTS drako_integration_connections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  integration_key TEXT NOT NULL,
  connection_label TEXT,
  status TEXT NOT NULL CHECK (status IN ('CONNECTED','PENDING','INVALID','DISCONNECTED','NEEDS_REAUTH')),
  metadata_json TEXT,
  last_validated_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(tenant_id, saas_id, integration_key)
);

CREATE INDEX IF NOT EXISTS idx_drako_integration_connections_lookup
ON drako_integration_connections(tenant_id, saas_id, integration_key, updated_at DESC);

CREATE TABLE IF NOT EXISTS drako_integration_credentials (
  id TEXT PRIMARY KEY,
  connection_id TEXT NOT NULL UNIQUE,
  credential_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_drako_integration_credentials_connection
ON drako_integration_credentials(connection_id);
