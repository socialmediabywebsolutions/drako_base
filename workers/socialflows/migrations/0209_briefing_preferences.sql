-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Cerebro Socialcors — weekly briefing preferences + delivery history.

CREATE TABLE IF NOT EXISTS socialcors_briefing_preferences (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  saas_id           TEXT NOT NULL,
  email_enabled     INTEGER DEFAULT 1,
  inapp_enabled     INTEGER DEFAULT 1,
  whatsapp_enabled  INTEGER DEFAULT 0,
  send_day          TEXT DEFAULT 'monday',
  send_hour         INTEGER DEFAULT 9,
  last_sent_at      TEXT,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, saas_id)
);

CREATE INDEX IF NOT EXISTS idx_socialcors_briefing_preferences_tenant
  ON socialcors_briefing_preferences (tenant_id, saas_id);

CREATE TABLE IF NOT EXISTS socialcors_briefing_history (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  saas_id        TEXT NOT NULL,
  briefing_json  TEXT NOT NULL,
  sent_via       TEXT,
  sent_at        TEXT DEFAULT (datetime('now')),
  week_number    INTEGER,
  year           INTEGER
);

CREATE INDEX IF NOT EXISTS idx_socialcors_briefing_history_tenant_sent
  ON socialcors_briefing_history (tenant_id, saas_id, sent_at DESC);
