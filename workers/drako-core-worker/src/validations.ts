import type {
  AgentsStatuses,
  AuditStatuses,
  GovernanceEventSpecsV1,
  GovernanceSchemaVersions,
  GovernanceSeverities,
  InsertAuditLogsInputs,
  LoopPhases,
  LoopStatuses,
  SaasesStatuses,
  UpsertAgentsInputs,
  UpsertLoopRunsInputs,
  UpsertSaasesInputs,
} from "./types";

type ValidationResults<T> = { ok: true; value: T } | { ok: false; errorMessage: string };

const UUID_PATTERNS = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_TYPE_PATTERNS = /^[a-z0-9]+([._-][a-z0-9]+)+$/;

const SAASES_STATUSES: SaasesStatuses[] = ["draft", "provisioning", "active", "paused", "archived"];
const AGENTS_STATUSES: AgentsStatuses[] = ["active", "disabled", "archived", "testing"];
const SEVERITY_NAMES: GovernanceSeverities[] = ["info", "warn", "error", "critical"];
const AUDIT_STATUSES: AuditStatuses[] = ["success", "failure", "warning", "info"];
const LOOP_PHASES: LoopPhases[] = ["ANALYZE", "OPTIMIZE", "SCALE"];
const LOOP_STATUSES: LoopStatuses[] = ["started", "completed", "failed", "canceled"];
const SCHEMA_VERSIONS: GovernanceSchemaVersions[] = ["v1"];

function readRequiredStrings(body: Record<string, unknown>, key: string, minLength = 1, maxLength = 256): string {
  const value = String(body[key] ?? "").trim();
  if (value.length < minLength || value.length > maxLength) {
    throw new Error(`Invalid field '${key}'.`);
  }
  return value;
}

function readOptionalStrings(body: Record<string, unknown>, key: string, maxLength = 512): string | null {
  const rawValue = body[key];
  if (rawValue == null) return null;
  const value = String(rawValue).trim();
  if (!value) return null;
  if (value.length > maxLength) throw new Error(`Invalid field '${key}'.`);
  return value;
}

function readRequiredEnums<T extends string>(
  body: Record<string, unknown>,
  key: string,
  allowedValues: readonly T[],
): T {
  const value = String(body[key] ?? "").trim() as T;
  if (!allowedValues.includes(value)) {
    throw new Error(`Invalid field '${key}'.`);
  }
  return value;
}

function readOptionalNumbers(body: Record<string, unknown>, key: string): number | null {
  if (body[key] == null) return null;
  const value = Number(body[key]);
  if (!Number.isFinite(value)) throw new Error(`Invalid field '${key}'.`);
  return value;
}

function readJsonStrings(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (value == null) return "{}";
  if (typeof value === "string") {
    const normalizedValue = value.trim();
    if (!normalizedValue) return "{}";
    JSON.parse(normalizedValue);
    return normalizedValue;
  }
  return JSON.stringify(value);
}

function readRequiredJsonObjects(body: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = body[key];
  if (value == null) return {};

  if (typeof value === "string") {
    const normalizedValue = value.trim();
    if (!normalizedValue) return {};
    const parsedValue = JSON.parse(normalizedValue);
    if (!parsedValue || Array.isArray(parsedValue) || typeof parsedValue !== "object") {
      throw new Error(`Invalid field '${key}'.`);
    }
    return parsedValue as Record<string, unknown>;
  }

  if (!Array.isArray(value) && typeof value === "object") {
    return value as Record<string, unknown>;
  }

  throw new Error(`Invalid field '${key}'.`);
}

function readRequiredUuids(body: Record<string, unknown>, key: string): string {
  const value = readRequiredStrings(body, key);
  if (!UUID_PATTERNS.test(value)) {
    throw new Error(`Invalid field '${key}'.`);
  }
  return value.toLowerCase();
}

function readRequiredIsoDates(body: Record<string, unknown>, key: string): string {
  const value = readRequiredStrings(body, key, 10, 64);
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    throw new Error(`Invalid field '${key}'.`);
  }
  return asDate.toISOString();
}

function readIsoDates(body: Record<string, unknown>, key: string, required: boolean): string | null {
  const value = body[key];
  if (!required && value == null) return null;
  const normalizedValue = String(value ?? "").trim();
  if (!normalizedValue) {
    if (required) throw new Error(`Invalid field '${key}'.`);
    return null;
  }
  const asDate = new Date(normalizedValue);
  if (Number.isNaN(asDate.getTime())) throw new Error(`Invalid field '${key}'.`);
  return asDate.toISOString();
}

export function validateSaasesRegistryPayloads(body: Record<string, unknown>): ValidationResults<UpsertSaasesInputs> {
  try {
    return {
      ok: true,
      value: {
        saasId: readRequiredStrings(body, "saasId"),
        saasSlug: readRequiredStrings(body, "saasSlug"),
        displayName: readRequiredStrings(body, "displayName"),
        statusName: readRequiredEnums(body, "statusName", SAASES_STATUSES),
        ownerTenantId: readOptionalStrings(body, "ownerTenantId"),
        domainName: readOptionalStrings(body, "domainName"),
        workerName: readOptionalStrings(body, "workerName"),
        databaseName: readOptionalStrings(body, "databaseName"),
        namespaceKey: readOptionalStrings(body, "namespaceKey"),
        metadataJson: readJsonStrings(body, "metadata"),
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}

export function validateAgentsRegistryPayloads(body: Record<string, unknown>): ValidationResults<UpsertAgentsInputs> {
  try {
    return {
      ok: true,
      value: {
        agentId: readRequiredStrings(body, "agentId"),
        saasSlug: readOptionalStrings(body, "saasSlug"),
        roleName: readRequiredStrings(body, "roleName"),
        modelName: readRequiredStrings(body, "modelName"),
        supervisorAgentId: readOptionalStrings(body, "supervisorAgentId"),
        statusName: readRequiredEnums(body, "statusName", AGENTS_STATUSES),
        estimatedCostPerRunMajor: Number(readOptionalNumbers(body, "estimatedCostPerRunMajor") ?? 0),
        metadataJson: readJsonStrings(body, "metadata"),
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}

export function validateGovernanceEventSpecsV1(
  body: Record<string, unknown>,
): ValidationResults<GovernanceEventSpecsV1> {
  try {
    const eventTypeValue = readRequiredStrings(body, "event_type", 3, 256);
    if (!EVENT_TYPE_PATTERNS.test(eventTypeValue)) {
      throw new Error("Invalid field 'event_type'.");
    }

    return {
      ok: true,
      value: {
        event_id: readRequiredUuids(body, "event_id"),
        event_type: eventTypeValue,
        source: readRequiredStrings(body, "source", 2, 128),
        saas_slug: readOptionalStrings(body, "saas_slug"),
        tenant_id: readOptionalStrings(body, "tenant_id"),
        actor_type: readRequiredStrings(body, "actor_type", 2, 64),
        actor_id: readRequiredStrings(body, "actor_id", 2, 128),
        severity: readRequiredEnums(body, "severity", SEVERITY_NAMES),
        occurred_at: readRequiredIsoDates(body, "occurred_at"),
        metadata: readRequiredJsonObjects(body, "metadata"),
        trace_id: readRequiredStrings(body, "trace_id", 8, 128),
        correlation_id: readRequiredStrings(body, "correlation_id", 8, 128),
        schema_version: readRequiredEnums(body, "schema_version", SCHEMA_VERSIONS),
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}

export function validateAuditLogsPayloads(body: Record<string, unknown>): ValidationResults<InsertAuditLogsInputs> {
  try {
    const action =
      (typeof body.action === "string" && body.action.trim()) ||
      (typeof body.actionName === "string" && body.actionName.trim()) ||
      "";

    return {
      ok: true,
      value: {
        logId: readOptionalStrings(body, "logId") ?? crypto.randomUUID(),
        actorType: readOptionalStrings(body, "actorType") ?? "system",
        actorId: readOptionalStrings(body, "actorId"),
        action: readRequiredStrings({ action }, "action", 1, 256),
        targetType: readRequiredStrings(body, "targetType"),
        targetId: readOptionalStrings(body, "targetId"),
        saasSlug: readOptionalStrings(body, "saasSlug"),
        tenantId: readOptionalStrings(body, "tenantId"),
        statusName: readRequiredEnums(body, "statusName", AUDIT_STATUSES),
        requestId: readOptionalStrings(body, "requestId"),
        ipAddress: readOptionalStrings(body, "ipAddress"),
        userAgent: readOptionalStrings(body, "userAgent"),
        metadata: readJsonStrings(body, "metadata"),
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}

export function validateLoopRunsPayloads(body: Record<string, unknown>): ValidationResults<UpsertLoopRunsInputs> {
  try {
    const startedAt = readIsoDates(body, "startedAt", false) ?? new Date().toISOString();
    const finishedAt = readIsoDates(body, "finishedAt", false);
    return {
      ok: true,
      value: {
        runId: readOptionalStrings(body, "runId") ?? crypto.randomUUID(),
        loopName: readOptionalStrings(body, "loopName") ?? "ANALYZE_OPTIMIZE_SCALE",
        phaseName: readRequiredEnums(body, "phaseName", LOOP_PHASES),
        statusName: readRequiredEnums(body, "statusName", LOOP_STATUSES),
        saasSlug: readOptionalStrings(body, "saasSlug"),
        tenantId: readOptionalStrings(body, "tenantId"),
        startedAt,
        finishedAt,
        durationMs: readOptionalNumbers(body, "durationMs"),
        metricsJson: readJsonStrings(body, "metrics"),
        notesText: readOptionalStrings(body, "notesText", 2048),
      },
    };
  } catch (error) {
    return { ok: false, errorMessage: error instanceof Error ? error.message : "Invalid payload." };
  }
}
