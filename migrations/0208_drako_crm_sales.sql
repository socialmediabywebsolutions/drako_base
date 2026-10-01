-- Ventas registradas desde "＋ Crear venta" del CRM de /operator/socialflow (DRACO_DB).
-- Solo CREATE ... IF NOT EXISTS: re-ejecutable, lo aplica el paso "Apply global schema
-- additions on DRACO_DB" del deploy. El cliente se crea en `clients`; aquí quedan el
-- plan, el importe mensual y las notas (clients no tiene columna de notas).
CREATE TABLE IF NOT EXISTS drako_crm_sales (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id TEXT NOT NULL,
  plan TEXT NOT NULL,
  amount_monthly INTEGER NOT NULL,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_crm_sales_client ON drako_crm_sales(client_id, created_at DESC);
