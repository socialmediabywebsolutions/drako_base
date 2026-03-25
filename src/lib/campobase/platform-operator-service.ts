import {
  AutomationCoreError,
  disableAutomation,
  enableAutomation,
  listAutomations,
  listAutomationExecutions,
  triggerAutomation,
  type AutomationExecution,
  type AutomationRegistration,
} from "@/lib/automation-core";
import {
  IntegrationCoreError,
  executeIntegrationOperation,
  listIntegrationConnections,
  validateIntegrationConnection,
  type IntegrationConnection,
} from "@/lib/integration-core";
import { loadPlatformForSaas } from "@/lib/campobase/platform-bootstrap";
import {
  captureHealthSnapshot,
  deriveObservabilityStatusSummary,
  getLatestHealthSnapshot,
  listObservabilityActivities,
  listObservabilityIncidents,
  type ObservabilityActivity,
  type ObservabilityHealthSnapshot,
  type ObservabilityIncident,
  type ObservabilityStatusSummary,
} from "@/lib/observability-core";

export type PlatformOperatorAutomationItem = {
  automationKey: string;
  displayName: string;
  enabled: boolean;
  frequencyLabel: string;
  configSummary: string;
  lastExecutionAt: string | null;
  lastResult: "SUCCESS" | "FAILED" | "RUNNING" | "NEVER";
  lastSummary: string | null;
};

export type PlatformOperatorIntegrationItem = {
  integrationKey: string;
  status: IntegrationConnection["status"];
  lastValidatedAt: string | null;
  lastError: string | null;
};

export type PlatformOperatorSurface = {
  tenantId: string;
  saasId: string;
  summary: ObservabilityStatusSummary;
  latestHealthSnapshot: ObservabilityHealthSnapshot | null;
  openIncidents: ObservabilityIncident[];
  recentActivity: ObservabilityActivity[];
  automations: PlatformOperatorAutomationItem[];
  integrations: PlatformOperatorIntegrationItem[];
};

function assertPlatformIdentity(input: { tenantId: string; saasId: string }) {
  if (!input.tenantId?.trim()) {
    throw new Error("PLATFORM_OPERATOR_TENANT_REQUIRED");
  }
  if (!input.saasId?.trim()) {
    throw new Error("PLATFORM_OPERATOR_SAAS_REQUIRED");
  }
}

function assertPlatformAutomationAction(input: { tenantId: string; saasId: string; automationKey: string }) {
  assertPlatformIdentity(input);
  if (!input.automationKey?.trim()) {
    throw new Error("PLATFORM_OPERATOR_AUTOMATION_KEY_REQUIRED");
  }
}

function assertPlatformIntegrationAction(input: { tenantId: string; saasId: string; integrationKey: string }) {
  assertPlatformIdentity(input);
  if (!input.integrationKey?.trim()) {
    throw new Error("PLATFORM_OPERATOR_INTEGRATION_KEY_REQUIRED");
  }
}

function assertPlatformIntegrationExecutionAction(input: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  operationKey: string;
}) {
  assertPlatformIntegrationAction(input);
  if (!input.operationKey?.trim()) {
    throw new Error("PLATFORM_OPERATOR_OPERATION_KEY_REQUIRED");
  }
}

function formatAutomationFrequency(registration: AutomationRegistration): string {
  if (!registration.frequencyValue || !registration.frequencyUnit) {
    return registration.scheduleMode === "manual" ? "Manual" : "Scheduled";
  }

  const unit = registration.frequencyValue === 1
    ? registration.frequencyUnit
    : `${registration.frequencyUnit}s`;

  return `${registration.frequencyValue} / ${unit}`;
}

function summarizeConfig(config: Record<string, unknown> | null): string {
  if (!config) {
    return "No config";
  }

  const entries = Object.entries(config)
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return entries.length ? entries.join(" | ") : "Config stored";
}

function buildLatestExecutionMap(executions: AutomationExecution[]) {
  const latestByKey = new Map<string, AutomationExecution>();

  for (const execution of executions) {
    if (!latestByKey.has(execution.automationKey)) {
      latestByKey.set(execution.automationKey, execution);
    }
  }

  return latestByKey;
}

function mapAutomationItem(
  registration: AutomationRegistration,
  latestExecution: AutomationExecution | null,
): PlatformOperatorAutomationItem {
  return {
    automationKey: registration.automationKey,
    displayName: registration.displayName,
    enabled: registration.enabled,
    frequencyLabel: formatAutomationFrequency(registration),
    configSummary: summarizeConfig(registration.config),
    lastExecutionAt: latestExecution?.createdAt ?? null,
    lastResult: latestExecution?.status ?? "NEVER",
    lastSummary: latestExecution?.summary ?? null,
  };
}

function mapIntegrationItem(connection: IntegrationConnection): PlatformOperatorIntegrationItem {
  return {
    integrationKey: connection.integrationKey,
    status: connection.status,
    lastValidatedAt: connection.lastValidatedAt,
    lastError: connection.lastErrorMessage ?? null,
  };
}

function deriveFreshnessStatus(latestActivityAt: string | null): "fresh" | "stale" | "unknown" {
  if (!latestActivityAt) {
    return "unknown";
  }

  const parsed = Date.parse(latestActivityAt);
  if (Number.isNaN(parsed)) {
    return "unknown";
  }

  const hoursSinceActivity = (Date.now() - parsed) / (1000 * 60 * 60);
  return hoursSinceActivity <= 48 ? "fresh" : "stale";
}

function deriveHealthStatus(
  incidents: ObservabilityIncident[],
  latestActivityAt: string | null,
): "healthy" | "needs_attention" | "degraded" | "unknown" {
  if (incidents.some((incident) => incident.severity === "critical" || incident.severity === "high")) {
    return "degraded";
  }

  if (incidents.length > 0) {
    return "needs_attention";
  }

  if (!latestActivityAt) {
    return "unknown";
  }

  return "healthy";
}

function deriveSnapshotSummary(params: {
  saasId: string;
  incidents: ObservabilityIncident[];
  latestActivityAt: string | null;
}) {
  if (params.incidents.length > 0) {
    return `Open incidents detected for ${params.saasId}.`;
  }

  if (!params.latestActivityAt) {
    return `No recent operational activity recorded for ${params.saasId}.`;
  }

  return `Operational signals look healthy for ${params.saasId}.`;
}

async function ensurePlatformReady(tenantId: string, saasId: string): Promise<void> {
  await loadPlatformForSaas(tenantId, saasId);
}

export async function getPlatformOperatorSurface(
  tenantId: string,
  saasId: string,
): Promise<PlatformOperatorSurface> {
  assertPlatformIdentity({ tenantId, saasId });
  await ensurePlatformReady(tenantId, saasId);

  const [automations, executions, integrations, latestHealthSnapshot, openIncidents, recentActivity] = await Promise.all([
    listAutomations({ tenantId, saasId }),
    listAutomationExecutions({ tenantId, saasId, limit: 100 }),
    listIntegrationConnections({ tenantId, saasId }),
    getLatestHealthSnapshot({ tenantId, saasId }),
    listObservabilityIncidents({ tenantId, saasId, status: "OPEN", limit: 20 }),
    listObservabilityActivities({ tenantId, saasId, limit: 20 }),
  ]);

  const latestExecutionByKey = buildLatestExecutionMap(executions);
  const summary = deriveObservabilityStatusSummary({
    tenantId,
    saasId,
    latestSnapshot: latestHealthSnapshot,
    openIncidents,
    recentActivity,
  });

  return {
    tenantId,
    saasId,
    summary,
    latestHealthSnapshot,
    openIncidents,
    recentActivity,
    automations: automations.map((registration) => mapAutomationItem(registration, latestExecutionByKey.get(registration.automationKey) ?? null)),
    integrations: integrations.map(mapIntegrationItem),
  };
}

export async function refreshPlatformOperatorSurface(
  tenantId: string,
  saasId: string,
): Promise<PlatformOperatorSurface> {
  assertPlatformIdentity({ tenantId, saasId });
  await ensurePlatformReady(tenantId, saasId);

  const [incidents, activity] = await Promise.all([
    listObservabilityIncidents({ tenantId, saasId, status: "OPEN", limit: 20 }),
    listObservabilityActivities({ tenantId, saasId, limit: 20 }),
  ]);

  const latestActivityAt = activity[0]?.createdAt ?? null;
  await captureHealthSnapshot({
    tenantId,
    saasId,
    scopeType: "saas",
    scopeKey: saasId,
    healthStatus: deriveHealthStatus(incidents, latestActivityAt),
    freshnessStatus: deriveFreshnessStatus(latestActivityAt),
    lastActivityAt: latestActivityAt,
    openIncidentsCount: incidents.length,
    summary: deriveSnapshotSummary({ saasId, incidents, latestActivityAt }),
  });

  return getPlatformOperatorSurface(tenantId, saasId);
}

export async function runPlatformAutomationAction(input: {
  tenantId: string;
  saasId: string;
  automationKey: string;
}) {
  assertPlatformAutomationAction(input);
  await ensurePlatformReady(input.tenantId, input.saasId);
  return triggerAutomation({
    tenantId: input.tenantId,
    saasId: input.saasId,
    automationKey: input.automationKey,
    triggerType: "manual",
    triggeredBy: "owner",
  });
}

export async function setPlatformAutomationEnabled(input: {
  tenantId: string;
  saasId: string;
  automationKey: string;
  enabled: boolean;
}) {
  assertPlatformAutomationAction(input);
  await ensurePlatformReady(input.tenantId, input.saasId);
  return input.enabled
    ? enableAutomation(input.tenantId, input.saasId, input.automationKey)
    : disableAutomation(input.tenantId, input.saasId, input.automationKey);
}

export async function validatePlatformIntegration(input: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
}) {
  assertPlatformIntegrationAction(input);
  await ensurePlatformReady(input.tenantId, input.saasId);
  return validateIntegrationConnection(input);
}

export async function executePlatformIntegrationOperation(input: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  operationKey: string;
  payload?: Record<string, unknown> | null;
}) {
  assertPlatformIntegrationExecutionAction(input);
  await ensurePlatformReady(input.tenantId, input.saasId);
  return executeIntegrationOperation(input);
}

export function resolvePlatformOperatorError(error: unknown): {
  status: number;
  code: string;
  message: string;
} {
  if (error instanceof AutomationCoreError) {
    if (error.code === "AUTOMATION_NOT_REGISTERED") {
      return { status: 404, code: error.code, message: "Automation is not registered for this SaaS." };
    }
    if (error.code === "AUTOMATION_DISABLED") {
      return { status: 409, code: error.code, message: "Automation is disabled for this SaaS." };
    }
    if (error.code === "AUTOMATION_EXECUTION_IN_PROGRESS") {
      return { status: 409, code: error.code, message: "Automation execution is already in progress for this SaaS." };
    }
    return { status: 400, code: error.code, message: error.message };
  }

  if (error instanceof IntegrationCoreError) {
    if (error.code === "INTEGRATION_CONNECTION_NOT_FOUND") {
      return { status: 404, code: error.code, message: "Integration connection was not found for this SaaS." };
    }
    if (error.code === "INTEGRATION_CONNECTION_INVALID" || error.code === "INTEGRATION_CONNECTION_DISCONNECTED") {
      return { status: 409, code: error.code, message: error.message };
    }
    return { status: 400, code: error.code, message: error.message };
  }

  if (error instanceof Error && error.message.startsWith("PLATFORM_OPERATOR_")) {
    return { status: 400, code: error.message, message: error.message };
  }

  return {
    status: 500,
    code: "PLATFORM_OPERATOR_UNEXPECTED_ERROR",
    message: error instanceof Error ? error.message : "Unexpected platform operator error",
  };
}
