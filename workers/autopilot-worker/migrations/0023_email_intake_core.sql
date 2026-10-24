CREATE TABLE IF NOT EXISTS saas_email_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  from_address TEXT NOT NULL,
  from_name TEXT,
  to_address TEXT,
  subject TEXT,
  snippet TEXT,
  body TEXT,
  received_at TEXT NOT NULL,
  classification TEXT NOT NULL,
  sub_type TEXT,
  status TEXT NOT NULL DEFAULT 'NEW',
  parsed_amount REAL,
  parsed_currency TEXT,
  parsed_due_date TEXT,
  parsed_supplier_name TEXT,
  linked_expense_id TEXT,
  linked_customer_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_messages_received_at
  ON saas_email_messages (tenant_id, saas_id, received_at);

CREATE INDEX IF NOT EXISTS idx_email_messages_classification
  ON saas_email_messages (tenant_id, saas_id, classification);

CREATE INDEX IF NOT EXISTS idx_email_messages_status
  ON saas_email_messages (tenant_id, saas_id, status);

CREATE TABLE IF NOT EXISTS saas_email_labels (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT
);

CREATE INDEX IF NOT EXISTS idx_email_labels_lookup
  ON saas_email_labels (tenant_id, saas_id, label);

CREATE TABLE IF NOT EXISTS saas_email_message_labels (
  email_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_message_labels_lookup
  ON saas_email_message_labels (tenant_id, saas_id, email_id);
