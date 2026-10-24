-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- CrossTenantIntelligenceAgent y ViralOpportunityAgent nunca dejan fila en
-- agent_execution_log (ni siquiera de error) — hipótesis: el Worker muere a mitad de
-- ejecución (límite de CPU/subrequests) antes de llegar al catch de
-- withAgentExecutionLog. Para diagnosticarlo, ambos agentes ahora insertan una fila
-- 'started' al entrar y la actualizan a 'completed' al terminar (ver
-- agent-execution-log.ts) — si el Worker muere entre medias, la fila se queda
-- atascada en 'started' para siempre, señalando exactamente dónde murió.
--
-- El CHECK original (migración 0240) solo permitía 'success'/'error'/'skipped'.
-- SQLite no soporta ALTER de un CHECK existente, así que la tabla se reconstruye para
-- ampliarlo — se preservan filas, columnas y el resto de constraints tal cual.
CREATE TABLE agent_execution_log_new (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  tenant_id TEXT,
  saas_id TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','error','skipped','started','completed')),
  rows_written INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO agent_execution_log_new (id, agent_name, tenant_id, saas_id, started_at, finished_at, status, rows_written, error_message, created_at)
SELECT id, agent_name, tenant_id, saas_id, started_at, finished_at, status, rows_written, error_message, created_at
FROM agent_execution_log;

DROP TABLE agent_execution_log;
ALTER TABLE agent_execution_log_new RENAME TO agent_execution_log;

CREATE INDEX IF NOT EXISTS idx_agent_execution_log_agent_name ON agent_execution_log (agent_name, started_at);
CREATE INDEX IF NOT EXISTS idx_agent_execution_log_tenant ON agent_execution_log (tenant_id, agent_name, started_at);
