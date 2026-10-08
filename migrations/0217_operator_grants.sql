-- 0217: Ayudas y subvenciones para el panel del operador Drako
-- Tabla principal de convocatorias y solicitudes de ayudas/subvenciones
CREATE TABLE IF NOT EXISTS operator_grants (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  -- Identificación
  name TEXT NOT NULL,
  entity TEXT NOT NULL,           -- Organismo convocante (CDTI, ICO, ENISA, etc.)
  description TEXT,
  program TEXT,                   -- Programa específico (Innvierte, Next Tech, etc.)
  url TEXT,                       -- URL oficial de la convocatoria
  -- Importe
  max_amount INTEGER,             -- Importe máximo en céntimos
  grant_type TEXT NOT NULL DEFAULT 'GRANT', -- GRANT | LOAN | SUBSIDY | ADVANCE
  -- Fechas
  deadline TEXT,                  -- ISO date del cierre de convocatoria
  applied_at TEXT,                -- Cuándo se presentó
  outcome_at TEXT,                -- Cuándo se resolvió
  -- Estado
  status TEXT NOT NULL DEFAULT 'IDENTIFIED',
  -- IDENTIFIED → la IA la encontró
  -- EVALUATING → estamos estudiando si aplica
  -- APPLYING → preparando documentación
  -- SUBMITTED → presentada
  -- APPROVED → concedida
  -- DENIED → denegada
  -- WITHDRAWN → retirada
  -- Documentación y notas
  requirements TEXT,              -- JSON array de requisitos
  documents_generated TEXT,       -- JSON array de docs generados
  notes TEXT,
  ai_summary TEXT,                -- Resumen que generó el agente IA
  ai_fit_score INTEGER,           -- 0-100 puntuación de ajuste al perfil
  -- Tracking
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_operator_grants_tenant ON operator_grants (tenant_id);
CREATE INDEX IF NOT EXISTS idx_operator_grants_status ON operator_grants (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_operator_grants_deadline ON operator_grants (tenant_id, deadline);
