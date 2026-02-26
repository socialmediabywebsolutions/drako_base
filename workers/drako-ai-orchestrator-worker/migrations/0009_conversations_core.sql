-- 0036_conversations_core.sql
-- Conversations, Messages and Notifications core tables

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS saas_conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  customer_id TEXT,
  channel TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL,
  last_message_at TEXT,
  last_customer_message_at TEXT,
  last_staff_message_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_conversations_tenant_saas_status
  ON saas_conversations (tenant_id, saas_id, status);
CREATE INDEX IF NOT EXISTS idx_saas_conversations_tenant_saas_customer
  ON saas_conversations (tenant_id, saas_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_saas_conversations_tenant_saas_channel
  ON saas_conversations (tenant_id, saas_id, channel);

CREATE TABLE IF NOT EXISTS saas_conversation_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  customer_id TEXT,
  employee_id TEXT,
  sender_type TEXT NOT NULL,
  direction TEXT NOT NULL,
  body TEXT NOT NULL,
  provider_message_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_conversation_messages_conversation
  ON saas_conversation_messages (tenant_id, saas_id, conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_saas_conversation_messages_customer
  ON saas_conversation_messages (tenant_id, saas_id, customer_id, created_at);

CREATE TABLE IF NOT EXISTS saas_notifications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT,
  employee_id TEXT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_notifications_read
  ON saas_notifications (tenant_id, saas_id, employee_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_saas_notifications_type
  ON saas_notifications (tenant_id, saas_id, type, created_at);

PRAGMA foreign_keys = ON;
