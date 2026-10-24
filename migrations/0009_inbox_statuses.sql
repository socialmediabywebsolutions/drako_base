PRAGMA foreign_keys = OFF;

CREATE TABLE inbox_messages_new (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK(channel IN ('email','whatsapp')),
  direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  body_preview TEXT NOT NULL,
  full_body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nuevo' CHECK(status IN ('nuevo','en_proceso','resuelto','archivado','error')),
  saas_id TEXT,
  department_id TEXT,
  tags TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (saas_id) REFERENCES saas(id),
  FOREIGN KEY (department_id) REFERENCES core_departments(id)
);

INSERT INTO inbox_messages_new (id, channel, direction, from_address, to_address, subject, body_preview, full_body, status, saas_id, department_id, tags, created_at, updated_at)
SELECT id, channel, direction, from_address, to_address, subject, body_preview, full_body, status, saas_id, department_id, tags, created_at, updated_at
FROM inbox_messages;

DROP TABLE inbox_messages;
ALTER TABLE inbox_messages_new RENAME TO inbox_messages;

CREATE INDEX IF NOT EXISTS idx_inbox_messages_channel ON inbox_messages(channel);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_status ON inbox_messages(status);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_saas ON inbox_messages(saas_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_department ON inbox_messages(department_id);

PRAGMA foreign_keys = ON;
