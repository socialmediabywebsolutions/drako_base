-- Tabla central en DRACO_DB para marcar cuentas propias del founder ("internal
-- accounts") como exentas de restricciones de facturación en cualquier SaaS del
-- ecosistema. Solo tabla + lectura — sin endpoint, sin UI. Gestión 100% manual vía
-- SQL directo (INSERT/DELETE) cuando Cristóbal decide marcar/desmarcar un tenant.
CREATE TABLE internal_accounts (
  tenant_id TEXT NOT NULL,
  saas_slug TEXT NOT NULL,
  label TEXT,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tenant_id, saas_slug)
);
