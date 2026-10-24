-- P1 PRODUCT REAL: Events, Notifications, Activity Tracking
-- Tabla central de eventos del sistema
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  student_id TEXT,
  family_id TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (family_id) REFERENCES families(id)
);

CREATE INDEX IF NOT EXISTS idx_events_student_id ON events(student_id);
CREATE INDEX IF NOT EXISTS idx_events_family_id ON events(family_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_id ON notifications(target_id);
CREATE INDEX IF NOT EXISTS idx_notifications_channel ON notifications(channel);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Tabla de logs de actividad del estudiante
CREATE TABLE IF NOT EXISTS student_activity_logs (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  duration_seconds INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_student_id ON student_activity_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON student_activity_logs(created_at);

-- Tabla de progreso del estudiante
CREATE TABLE IF NOT EXISTS student_progress (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject TEXT,
  level INTEGER,
  score REAL,
  completed_activities INTEGER DEFAULT 0,
  total_activities INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_progress_student_id ON student_progress(student_id);

-- Tabla de relación familia-estudiante (muchos a muchos)
CREATE TABLE IF NOT EXISTS family_memberships (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  role TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(family_id, student_id),
  FOREIGN KEY (family_id) REFERENCES families(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

CREATE INDEX IF NOT EXISTS idx_family_memberships_family_id ON family_memberships(family_id);
CREATE INDEX IF NOT EXISTS idx_family_memberships_student_id ON family_memberships(student_id);

-- Tabla de relación estudiante-guardián (muchos a muchos)
CREATE TABLE IF NOT EXISTS student_guardians (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  guardian_id TEXT NOT NULL,
  relationship TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(student_id, guardian_id),
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (guardian_id) REFERENCES guardians(id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student_id ON student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_guardian_id ON student_guardians(guardian_id);

-- Tabla de contactos WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id TEXT PRIMARY KEY,
  guardian_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  verified BOOLEAN DEFAULT 0,
  opted_in BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL,
  UNIQUE(guardian_id, phone_number),
  FOREIGN KEY (guardian_id) REFERENCES guardians(id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_guardian_id ON whatsapp_contacts(guardian_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_phone_number ON whatsapp_contacts(phone_number);
