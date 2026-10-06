-- Mentoría — Protocolo de Seguridad: log de alertas de seguridad enviadas a padres/tutores
-- Permite al Cerebro Académico saber si hay una alerta reciente y ajustar el tono del tutor.

CREATE TABLE IF NOT EXISTS mentoria_safety_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  parent_phone TEXT NOT NULL,
  level TEXT NOT NULL,       -- 'medium' | 'high'
  category TEXT NOT NULL,    -- SafetyAlertCategory
  message_id TEXT,           -- WhatsApp message ID si el envío fue exitoso
  send_status TEXT NOT NULL, -- 'success' | 'failed'
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_safety_alerts_student ON mentoria_safety_alerts(student_id);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_tenant_student ON mentoria_safety_alerts(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_safety_alerts_created ON mentoria_safety_alerts(created_at);
