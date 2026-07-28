-- SocialFlow Fase 3: Conversational AI Engine
-- Tables: conversation threads inbox + per-tenant auto-send settings

CREATE TABLE IF NOT EXISTS socialflow_conversation_threads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  thread_type TEXT NOT NULL,
  platform_thread_id TEXT,
  sender_name TEXT,
  sender_handle TEXT,
  incoming_message TEXT NOT NULL,
  context_post_id TEXT,
  suggested_reply TEXT,
  final_reply TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  ai_metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sf_conv_threads_platform
  ON socialflow_conversation_threads (tenant_id, saas_id, platform_thread_id)
  WHERE platform_thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sf_conv_threads_tenant
  ON socialflow_conversation_threads (tenant_id, saas_id);

CREATE INDEX IF NOT EXISTS idx_sf_conv_threads_status
  ON socialflow_conversation_threads (tenant_id, saas_id, status);

CREATE TABLE IF NOT EXISTS socialflow_conversation_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  auto_send_enabled INTEGER NOT NULL DEFAULT 0,
  auto_send_providers TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, saas_id)
);
