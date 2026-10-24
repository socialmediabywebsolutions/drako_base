-- Mentoría — Protocolo de Seguridad: revisión por operador
-- Permite marcar alertas como revisadas y añadir notas de seguimiento.

ALTER TABLE mentoria_safety_alerts ADD COLUMN reviewed_at TEXT;
ALTER TABLE mentoria_safety_alerts ADD COLUMN reviewed_by TEXT;
ALTER TABLE mentoria_safety_alerts ADD COLUMN review_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_safety_alerts_reviewed ON mentoria_safety_alerts(reviewed_at);
