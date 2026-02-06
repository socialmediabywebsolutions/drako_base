-- Administrative backbone for DRĀKO BASE
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nif TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  nif TEXT,
  email TEXT,
  phone TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (owner_id) REFERENCES owners(id)
);

CREATE TABLE IF NOT EXISTS client_saas (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  plan TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (saas_id) REFERENCES saas(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  number TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'draft',
  period_from TEXT,
  period_to TEXT,
  issued_at TEXT,
  due_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  external_id TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (saas_id) REFERENCES saas(id)
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  channel TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  closed_at TEXT,
  FOREIGN KEY (client_id) REFERENCES clients(id),
  FOREIGN KEY (saas_id) REFERENCES saas(id)
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id TEXT PRIMARY KEY,
  saas_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  handle TEXT,
  url TEXT,
  is_connected INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT,
  FOREIGN KEY (saas_id) REFERENCES saas(id),
  UNIQUE (saas_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_client_saas_client_saas ON client_saas(client_id, saas_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_saas_status ON invoices(client_id, saas_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_saas_status ON tickets(saas_id, status);
