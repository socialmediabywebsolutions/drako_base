-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Rastro de ejecución real por agente del Cerebro Socialcors — ninguno de los 26
-- agentes/crons tenía hoy un log de éxito/error, solo la señal indirecta de última
-- escritura en su propia tabla de salida (ver auditoría de solo lectura previa).
CREATE TABLE IF NOT EXISTS agent_execution_log (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  tenant_id TEXT,
  saas_id TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','error','skipped')),
  rows_written INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_execution_log_agent_name ON agent_execution_log (agent_name, started_at);
CREATE INDEX IF NOT EXISTS idx_agent_execution_log_tenant ON agent_execution_log (tenant_id, agent_name, started_at);
