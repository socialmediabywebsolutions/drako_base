-- 0218_mentoria_family_messages.sql
-- Mensajes del mentor hacia la familia de un alumno
-- Los mensajes son unidireccionales: mentor → familia

CREATE TABLE IF NOT EXISTS mentoria_family_messages (
  id            TEXT    PRIMARY KEY,
  tenant_id     TEXT    NOT NULL,
  student_id    TEXT    NOT NULL,   -- student_profile_id
  sender_id     TEXT    NOT NULL,   -- mentor user_id (mentoria_users)
  recipient_email TEXT  NOT NULL,   -- email del guardian destino (puede ser NULL para broadcast a toda la familia)
  subject       TEXT    NOT NULL,
  body          TEXT    NOT NULL,
  message_type  TEXT    NOT NULL DEFAULT 'general',  -- general | alert | report | achievement
  status        TEXT    NOT NULL DEFAULT 'sent',     -- sent | delivered | read
  created_at    TEXT    NOT NULL,
  read_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_mentoria_family_messages_tenant ON mentoria_family_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_family_messages_student ON mentoria_family_messages(student_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_family_messages_recipient ON mentoria_family_messages(recipient_email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_mentoria_family_messages_created ON mentoria_family_messages(created_at DESC);
