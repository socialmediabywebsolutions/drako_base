-- 0031_saas_tasks_core.sql
-- Persistent tasks for owners and staff.

CREATE TABLE IF NOT EXISTS saas_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  assignee_employee_id TEXT,
  due_date TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_tasks_tenant_saas_status ON saas_tasks(tenant_id, saas_id, status);
CREATE INDEX IF NOT EXISTS idx_saas_tasks_tenant_saas_category ON saas_tasks(tenant_id, saas_id, category);
CREATE INDEX IF NOT EXISTS idx_saas_tasks_tenant_saas_assignee_status ON saas_tasks(tenant_id, saas_id, assignee_employee_id, status);

CREATE TABLE IF NOT EXISTS saas_task_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  saas_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saas_task_events_task_created ON saas_task_events(tenant_id, saas_id, task_id, created_at);
