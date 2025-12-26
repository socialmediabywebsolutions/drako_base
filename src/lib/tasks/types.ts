export type SaasTaskStatus = "OPEN" | "IN_PROGRESS" | "DONE" | "DISCARDED";

export type SaasTaskCategory = "ECONOMY" | "HR" | "SOCIAL" | "EMAIL" | "BLUEPRINT" | "TAX" | "OTHER";

export type SaasTaskSource = "AUTOPILOT" | "MANUAL_OWNER" | "MANUAL_STAFF";

export type SaasTaskSeverity = "INFO" | "SUGGESTION" | "WARNING" | "CRITICAL";

export type SaasTask = {
  id: string;
  tenantId: string;
  saasId: string;
  title: string;
  description?: string | null;
  category: SaasTaskCategory;
  source: SaasTaskSource;
  status: SaasTaskStatus;
  severity: SaasTaskSeverity;
  assigneeEmployeeId?: string | null;
  dueDate?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasTaskEventType = "CREATED" | "STATUS_CHANGED" | "REASSIGNED" | "UPDATED" | "COMMENT";

export type SaasTaskEvent = {
  id: string;
  tenantId: string;
  saasId: string;
  taskId: string;
  type: SaasTaskEventType;
  payload?: Record<string, unknown> | null;
  createdAt: string;
};

export type CreateTaskInput = {
  saasId: string;
  title: string;
  description?: string | null;
  category: SaasTaskCategory;
  source: SaasTaskSource;
  status?: SaasTaskStatus;
  severity: SaasTaskSeverity;
  assigneeEmployeeId?: string | null;
  dueDate?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  category?: SaasTaskCategory;
  status?: SaasTaskStatus;
  severity?: SaasTaskSeverity;
  assigneeEmployeeId?: string | null;
  dueDate?: string | null;
  metadata?: Record<string, unknown> | null;
};
