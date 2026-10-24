PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guardians (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  family_id TEXT NOT NULL,
  role TEXT CHECK(role IN ('father','mother','tutor')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id)
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER,
  level TEXT,
  family_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (family_id) REFERENCES families(id)
);

CREATE INDEX IF NOT EXISTS idx_guardians_family_id ON guardians(family_id);
CREATE INDEX IF NOT EXISTS idx_guardians_email ON guardians(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_guardians_family_email ON guardians(family_id, email);
CREATE INDEX IF NOT EXISTS idx_students_family_id ON students(family_id);
