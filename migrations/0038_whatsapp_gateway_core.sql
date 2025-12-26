-- 0038_whatsapp_gateway_core.sql
-- WhatsApp gateway identities + messages

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS saas_whatsapp_identities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  preferred_language TEXT,
  allowed_channels TEXT,
  consent_flags TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_identities_tenant_saas
  ON saas_whatsapp_identities (tenant_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_identities_phone
  ON saas_whatsapp_identities (tenant_id, saas_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_identities_actor
  ON saas_whatsapp_identities (tenant_id, saas_id, actor_type, actor_id);

CREATE TABLE IF NOT EXISTS saas_whatsapp_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  direction TEXT NOT NULL,
  actor_type TEXT,
  actor_id TEXT,
  conversation_id TEXT,
  body TEXT NOT NULL,
  intent TEXT,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_messages_phone
  ON saas_whatsapp_messages (tenant_id, saas_id, phone_number, created_at);
CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_messages_conversation
  ON saas_whatsapp_messages (tenant_id, saas_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_saas_whatsapp_messages_direction
  ON saas_whatsapp_messages (tenant_id, saas_id, direction, created_at);

PRAGMA foreign_keys = ON;
