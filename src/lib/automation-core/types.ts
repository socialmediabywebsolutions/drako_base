export type AutomationOwnerScope = "OWNER";

export type AutomationScheduleMode = "manual" | "scheduled";

export type AutomationFrequencyUnit = "hour" | "day" | "week";

export type AutomationTriggerType = "manual" | "scheduled" | "retry" | "system";

export type AutomationExecutionStatus = "RUNNING" | "SUCCESS" | "FAILED";

export type AutomationConfig = Record<string, unknown> | null;

export type AutomationMetrics = Record<string, number>;

export type AutomationOutput = Record<string, unknown> | null;

export type AutomationError = {
  code: string;
  message: string;
};

export type AutomationRegistration = {
  id: string;
  tenantId: string;
  saasId: string;
  automationKey: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  scheduleMode: AutomationScheduleMode;
  frequencyUnit: AutomationFrequencyUnit | null;
  frequencyValue: number | null;
  config: AutomationConfig;
  ownerScope: AutomationOwnerScope;
  createdAt: string;
  updatedAt: string;
};

export type RegisterAutomationInput = {
  tenantId: string;
  saasId: string;
  automationKey: string;
  displayName: string;
  description?: string | null;
  enabled?: boolean;
  scheduleMode?: AutomationScheduleMode;
  frequencyUnit?: AutomationFrequencyUnit | null;
  frequencyValue?: number | null;
  config?: AutomationConfig;
  ownerScope?: AutomationOwnerScope;
};

export type AutomationExecution = {
  id: string;
  tenantId: string;
  saasId: string;
  automationKey: string;
  triggerType: AutomationTriggerType;
  triggeredBy: string | null;
  status: AutomationExecutionStatus;
  summary: string | null;
  metrics: AutomationMetrics;
  output: AutomationOutput;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AutomationExecutionResult = {
  ok: boolean;
  summary?: string | null;
  metrics?: AutomationMetrics;
  output?: AutomationOutput;
  error?: AutomationError | null;
};

export type AutomationHandlerInput = {
  executionId: string;
  tenantId: string;
  saasId: string;
  automationKey: string;
  config: AutomationConfig;
  triggerType: AutomationTriggerType;
};

export type AutomationHandler = (
  input: AutomationHandlerInput,
) => Promise<AutomationExecutionResult>;

export type TriggerAutomationInput = {
  tenantId: string;
  saasId: string;
  automationKey: string;
  triggerType?: AutomationTriggerType;
  triggeredBy?: string | null;
};

export type ListAutomationsFilters = {
  tenantId?: string | null;
  saasId?: string | null;
  automationKey?: string | null;
  enabled?: boolean | null;
};

export type ListAutomationExecutionsFilters = {
  tenantId?: string | null;
  saasId?: string | null;
  automationKey?: string | null;
  status?: Exclude<AutomationExecutionStatus, "RUNNING"> | null;
  limit?: number;
};

export type AutomationExecutionSummary = {
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  successRate: number;
  failedRate: number;
  latestRunAt: string | null;
  latestFailedRunAt: string | null;
};

export class AutomationCoreError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "AutomationCoreError";
    this.code = code;
  }
}
