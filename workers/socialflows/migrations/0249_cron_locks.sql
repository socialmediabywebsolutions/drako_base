-- Bloqueo por turno de las rutas /api/cron/social/* (ver src/lib/security/cron-lock.ts).
-- Una fila por (ruta, inicio del turno): el PRIMARY KEY hace que solo la primera llamada
-- de cada turno ejecute; las duplicadas (evento scheduled repetido por Cloudflare,
-- runbook de GitHub) chocan con el INSERT y devuelven 200 sin hacer nada.
CREATE TABLE IF NOT EXISTS cron_locks (
  cron_route TEXT NOT NULL,
  turn       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (cron_route, turn)
);

CREATE INDEX IF NOT EXISTS idx_cron_locks_created_at ON cron_locks (created_at);
