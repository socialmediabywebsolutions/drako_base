import { getIntegrationConnection, updateIntegrationConnectionState } from "@/lib/integration-core/connections";
import { getIntegrationDefinition } from "@/lib/integration-core/definitions";
import { getIntegrationProvider } from "@/lib/integration-core/providers";
import { nowIso } from "@/lib/integration-core/shared";
import { openObservabilityIncident, recordObservabilityActivity, resolveObservabilityIncidentsByScope } from "@/lib/observability-core";
import {
  IntegrationCoreError,
  type ExecuteIntegrationOperationInput,
  type IntegrationConnection,
  type IntegrationProviderExecuteResult,
  type IntegrationProviderValidateResult,
} from "@/lib/integration-core/types";

function ensureConnectionReady(connection: IntegrationConnection) {
  if (connection.status === "DISCONNECTED") {
    throw new IntegrationCoreError("INTEGRATION_CONNECTION_DISCONNECTED");
  }
  if (connection.status === "INVALID" || connection.status === "NEEDS_REAUTH") {
    throw new IntegrationCoreError("INTEGRATION_CONNECTION_INVALID");
  }
}

function validateIntegrationIdentity(input: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
}) {
  if (!input.tenantId?.trim()) {
    throw new IntegrationCoreError("INTEGRATION_TENANT_REQUIRED");
  }
  if (!input.saasId?.trim()) {
    throw new IntegrationCoreError("INTEGRATION_SAAS_REQUIRED");
  }
  if (!input.integrationKey?.trim()) {
    throw new IntegrationCoreError("INTEGRATION_KEY_REQUIRED");
  }
}

async function recordIntegrationActivity(params: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  activityType: string;
  status: "success" | "warning" | "error";
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await recordObservabilityActivity({
      tenantId: params.tenantId,
      saasId: params.saasId,
      sourceType: "integration",
      sourceKey: params.integrationKey,
      activityType: params.activityType,
      status: params.status,
      summary: params.summary,
      metadata: params.metadata ?? null,
    });
  } catch (error) {
    console.error("INTEGRATION_OBSERVABILITY_ACTIVITY_ERROR", error);
  }
}

async function openIntegrationIncident(params: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  incidentType: string;
  severity: "medium" | "high";
  summary: string;
  details?: Record<string, unknown> | null;
}) {
  try {
    await openObservabilityIncident({
      tenantId: params.tenantId,
      saasId: params.saasId,
      sourceType: "integration",
      sourceKey: params.integrationKey,
      incidentType: params.incidentType,
      severity: params.severity,
      summary: params.summary,
      details: params.details ?? null,
    });
  } catch (error) {
    console.error("INTEGRATION_OBSERVABILITY_INCIDENT_ERROR", error);
  }
}

export async function validateIntegrationConnection(input: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
}): Promise<IntegrationProviderValidateResult & { connection: IntegrationConnection }> {
  validateIntegrationIdentity(input);
  const definition = await getIntegrationDefinition(input.integrationKey);
  if (!definition) {
    throw new IntegrationCoreError("INTEGRATION_DEFINITION_NOT_FOUND");
  }

  const connection = await getIntegrationConnection(input.tenantId, input.saasId, input.integrationKey);
  if (!connection) {
    throw new IntegrationCoreError("INTEGRATION_CONNECTION_NOT_FOUND");
  }

  const provider = getIntegrationProvider(input.integrationKey);
  if (!provider) {
    throw new IntegrationCoreError("INTEGRATION_PROVIDER_NOT_REGISTERED");
  }

  const validation = await provider.validate({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: input.integrationKey,
    connection,
  });

  const checkedAt = validation.checkedAt ?? nowIso();
  const updated = await updateIntegrationConnectionState({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: input.integrationKey,
    status: validation.status,
    metadata: validation.metadata ?? connection.metadata,
    checkedAt,
    errorCode: validation.error?.code ?? null,
    errorMessage: validation.error?.message ?? null,
  });

  await recordIntegrationActivity({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: input.integrationKey,
    activityType: "integration_validation",
    status: validation.ok ? "success" : "error",
    summary: validation.ok
      ? `Integration ${input.integrationKey} validated successfully.`
      : validation.error?.message ?? `Integration ${input.integrationKey} validation failed.`,
    metadata: {
      integrationKey: input.integrationKey,
      validationStatus: validation.status,
      errorCode: validation.error?.code ?? null,
    },
  });

  if (!validation.ok && (validation.status === "INVALID" || validation.status === "NEEDS_REAUTH")) {
    await openIntegrationIncident({
      tenantId: input.tenantId,
      saasId: input.saasId,
      integrationKey: input.integrationKey,
      incidentType: "integration_connection_invalid",
      severity: "high",
      summary: validation.error?.message ?? `Integration ${input.integrationKey} is invalid.`,
      details: {
        integrationKey: input.integrationKey,
        errorCode: validation.error?.code ?? null,
      },
    });
  } else if (validation.ok) {
    await resolveObservabilityIncidentsByScope({
      tenantId: input.tenantId,
      saasId: input.saasId,
      sourceType: "integration",
      sourceKey: input.integrationKey,
      incidentType: "integration_connection_invalid",
    });
  }

  return {
    ...validation,
    checkedAt,
    connection: updated,
  };
}

export async function executeIntegrationOperation(
  input: ExecuteIntegrationOperationInput,
): Promise<IntegrationProviderExecuteResult> {
  validateIntegrationIdentity(input);
  if (!input.operationKey?.trim()) {
    throw new IntegrationCoreError("INTEGRATION_OPERATION_REQUIRED");
  }
  const definition = await getIntegrationDefinition(input.integrationKey);
  if (!definition) {
    throw new IntegrationCoreError("INTEGRATION_DEFINITION_NOT_FOUND");
  }
  if (!definition.supportedOperations.includes(input.operationKey)) {
    throw new IntegrationCoreError("INTEGRATION_OPERATION_NOT_SUPPORTED");
  }

  const connection = await getIntegrationConnection(input.tenantId, input.saasId, input.integrationKey);
  if (!connection) {
    throw new IntegrationCoreError("INTEGRATION_CONNECTION_NOT_FOUND");
  }

  ensureConnectionReady(connection);

  const provider = getIntegrationProvider(input.integrationKey);
  if (!provider) {
    throw new IntegrationCoreError("INTEGRATION_PROVIDER_NOT_REGISTERED");
  }

  const result = await provider.executeOperation({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: input.integrationKey,
    operationKey: input.operationKey,
    payload: input.payload ?? null,
    connection,
  });

  if (!result.ok) {
    await recordIntegrationActivity({
      tenantId: input.tenantId,
      saasId: input.saasId,
      integrationKey: input.integrationKey,
      activityType: "integration_operation",
      status: "error",
      summary: result.error?.message ?? `Integration operation ${input.operationKey} failed.`,
      metadata: {
        operationKey: input.operationKey,
        errorCode: result.error?.code ?? null,
      },
    });
    await openIntegrationIncident({
      tenantId: input.tenantId,
      saasId: input.saasId,
      integrationKey: input.integrationKey,
      incidentType: "integration_operation_failed",
      severity: "medium",
      summary: result.error?.message ?? `Integration operation ${input.operationKey} failed.`,
      details: {
        operationKey: input.operationKey,
        errorCode: result.error?.code ?? null,
      },
    });
    throw new IntegrationCoreError(
      result.error?.code ?? "INTEGRATION_OPERATION_FAILED",
      result.error?.message,
    );
  }

  await recordIntegrationActivity({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: input.integrationKey,
    activityType: "integration_operation",
    status: "success",
    summary: `Integration operation ${input.operationKey} completed successfully.`,
    metadata: {
      operationKey: input.operationKey,
    },
  });
  await resolveObservabilityIncidentsByScope({
    tenantId: input.tenantId,
    saasId: input.saasId,
    sourceType: "integration",
    sourceKey: input.integrationKey,
    incidentType: "integration_operation_failed",
  });

  return {
    ok: true,
    result: result.result ?? null,
    error: null,
  };
}
