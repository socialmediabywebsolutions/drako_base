-- 0018_employees.sql
-- Core tables for Employee Partner agents: employees, skills, and schedules.

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT,
  avatar_url TEXT,
  notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_tenant_saas ON employees(tenant_id, saas_id);

CREATE TABLE IF NOT EXISTS employee_skills (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  skill TEXT NOT NULL,
  level TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_skills_employee ON employee_skills(employee_id);

CREATE TABLE IF NOT EXISTS employee_schedules (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_employee ON employee_schedules(employee_id);
