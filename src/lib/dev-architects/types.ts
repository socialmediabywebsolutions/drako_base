export type DevArchitectProjectType = "saas" | "core" | "experiment";
export type DevArchitectProjectStatus = "active" | "pending" | "broken";
export type DevArchitectMode = "Review" | "Fix" | "Refactor" | "Guide" | "Audit";
export type DevArchitectChecklistStatus = "ok" | "pending";
export type DevArchitectAlertStatus = "open" | "resolved";
export type DevArchitectAlertSeverity = "critical" | "high" | "medium" | "low";
export type DevArchitectTaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type DevArchitectTaskPriority = "low" | "medium" | "high" | "urgent";
export type DevArchitectTaskSource = "manual" | "audit" | "alert";

export type DevArchitectProject = {
  id: string;
  tenant_id?: string;
  name: string;
  type: DevArchitectProjectType;
  origin?: string | null;
  origin_url?: string | null;
  branch_name?: string | null;
  status: DevArchitectProjectStatus;
  last_build_status?: string | null;
  last_action_summary?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DevArchitectSession = {
  id: string;
  tenant_id?: string;
  project_id: string;
  mode: DevArchitectMode;
  title: string;
  last_interaction_at: string;
  summary?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type DevArchitectChecklist = {
  id: string;
  tenant_id?: string;
  project_id: string;
  key: string;
  label: string;
  status: DevArchitectChecklistStatus;
  created_at?: string;
  updated_at?: string;
};

export type DevArchitectAlert = {
  id: string;
  tenant_id?: string;
  devarchitect_project_id?: string | null;
  severity: DevArchitectAlertSeverity;
  source: string;
  message: string;
  metadata?: string | null;
  status: DevArchitectAlertStatus;
  created_at: string;
  resolved_at?: string | null;
};

export type DevArchitectProjectMetrics = {
  project_id: string;
  alerts_open: number;
  max_severity?: DevArchitectAlertSeverity | null;
  last_audit_at?: string | null;
  last_audit_status?: "OK" | "WARNING" | null;
  total_rules_ok: number;
  total_rules_pending: number;
};

export type DevArchitectTask = {
  id: string;
  tenant_id?: string;
  project_id: string;
  title: string;
  description?: string | null;
  status: DevArchitectTaskStatus;
  priority: DevArchitectTaskPriority;
  source: DevArchitectTaskSource;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
};
