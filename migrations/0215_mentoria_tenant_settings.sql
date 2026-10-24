-- Mentoria tenant settings table
-- Stores configuration per tenant (center name, contact info, WhatsApp, etc.)

CREATE TABLE IF NOT EXISTS mentoria_tenant_settings (
  tenant_id        TEXT NOT NULL,
  center_name      TEXT NOT NULL DEFAULT '',
  contact_email    TEXT NOT NULL DEFAULT '',
  contact_phone    TEXT NOT NULL DEFAULT '',
  whatsapp_number  TEXT NOT NULL DEFAULT '',
  timezone         TEXT NOT NULL DEFAULT 'Europe/Madrid',
  language         TEXT NOT NULL DEFAULT 'es',
  welcome_message  TEXT NOT NULL DEFAULT '',
  logo_url         TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id)
);
