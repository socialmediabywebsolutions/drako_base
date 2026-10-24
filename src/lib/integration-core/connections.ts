import { queryAll, queryOne, run } from "@/lib/db";
import { getIntegrationDefinition } from "@/lib/integration-core/definitions";
import { generateId, nowIso, parseJsonObject, stringifyJson } from "@/lib/integration-core/shared";
import {
  IntegrationCoreError,
  type ConnectIntegrationInput,
  type IntegrationConnection,
} from "@/lib/integration-core/types";

type ConnectionRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  integration_key: string;
  connection_label: string | null;
  status: string;
  metadata_json: string | null;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
};

type CredentialRow = {
  connection_id: string;
  credential_type: string;
  payload_json: string | null;
  created_at: string;
  updated_at: string;
};

function mapConnection(
  row: ConnectionRow,
  credentials: CredentialRow | null,
): IntegrationConnection {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    integrationKey: row.integration_key,
    connectionLabel: row.connection_label ?? null,
    status: row.status as IntegrationConnection["status"],
    metadata: parseJsonObject(row.metadata_json, null),
    credentials: credentials ? parseJsonObject(credentials.payload_json, null) : null,
    lastValidatedAt: row.last_validated_at ?? null,
    lastErrorCode: row.last_error_code ?? null,
    lastErrorMessage: row.last_error_message ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCredentialRow(connectionId: string): Promise<CredentialRow | null> {
  return queryOne<CredentialRow>(
    `SELECT connection_id, credential_type, payload_json, created_at, updated_at
     FROM drako_integration_credentials
     WHERE connection_id = ?
     LIMIT 1`,
    connectionId,
  );
}

function validateConnectionIdentity(input: { tenantId: string; saasId: string; integrationKey: string }) {
  if (!input.tenantId?.trim()) throw new IntegrationCoreError("INTEGRATION_TENANT_REQUIRED");
  if (!input.saasId?.trim()) throw new IntegrationCoreError("INTEGRATION_SAAS_REQUIRED");
  if (!input.integrationKey?.trim()) throw new IntegrationCoreError("INTEGRATION_KEY_REQUIRED");
}

export async function getIntegrationConnection(
  tenantId: string,
  saasId: string,
  integrationKey: string,
): Promise<IntegrationConnection | null> {
  validateConnectionIdentity({ tenantId, saasId, integrationKey });
  const row = await queryOne<ConnectionRow>(
    `SELECT id, tenant_id, saas_id, integration_key, connection_label, status, metadata_json, last_validated_at, last_error_code, last_error_message, created_at, updated_at
     FROM drako_integration_connections
     WHERE tenant_id = ? AND saas_id = ? AND integration_key = ?
     LIMIT 1`,
    tenantId,
    saasId,
    integrationKey,
  );
  if (!row) return null;
  const credentials = await getCredentialRow(row.id);
  return mapConnection(row, credentials);
}

export async function connectIntegration(input: ConnectIntegrationInput): Promise<IntegrationConnection> {
  validateConnectionIdentity(input);
  const definition = await getIntegrationDefinition(input.integrationKey.trim());
  if (!definition) {
    throw new IntegrationCoreError("INTEGRATION_DEFINITION_NOT_FOUND");
  }

  const tenantId = input.tenantId.trim();
  const saasId = input.saasId.trim();
  const integrationKey = input.integrationKey.trim();
  const existing = await getIntegrationConnection(tenantId, saasId, integrationKey);
  const now = nowIso();
  const connectionId = existing?.id ?? generateId("connection");
  const status = input.status ?? existing?.status ?? "PENDING";
  const connectionLabel = typeof input.connectionLabel === "undefined"
    ? existing?.connectionLabel ?? null
    : input.connectionLabel ?? null;
  const metadata = typeof input.metadata === "undefined" ? existing?.metadata ?? null : input.metadata ?? null;
  const credentials = typeof input.credentials === "undefined" ? existing?.credentials ?? null : input.credentials ?? null;

  if (existing) {
    await run(
      `UPDATE drako_integration_connections
       SET connection_label = ?, status = ?, metadata_json = ?, updated_at = ?
       WHERE id = ?`,
      connectionLabel,
      status,
      stringifyJson(metadata),
      now,
      connectionId,
    );
  } else {
    await run(
      `INSERT INTO drako_integration_connections (
        id, tenant_id, saas_id, integration_key, connection_label, status, metadata_json, last_validated_at, last_error_code, last_error_message, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?)`,
      connectionId,
      tenantId,
      saasId,
      integrationKey,
      connectionLabel,
      status,
      stringifyJson(metadata),
      now,
      now,
    );
  }

  const existingCredential = await getCredentialRow(connectionId);
  if (existingCredential) {
    await run(
      `UPDATE drako_integration_credentials
       SET payload_json = ?, updated_at = ?
       WHERE connection_id = ?`,
      stringifyJson(credentials),
      now,
      connectionId,
    );
  } else {
    await run(
      `INSERT INTO drako_integration_credentials (
        id, connection_id, credential_type, payload_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      generateId("credential"),
      connectionId,
      definition.authMode,
      stringifyJson(credentials),
      now,
      now,
    );
  }

  const connected = await getIntegrationConnection(tenantId, saasId, integrationKey);
  if (!connected) throw new IntegrationCoreError("INTEGRATION_CONNECTION_PERSIST_FAILED");
  return connected;
}

export async function disconnectIntegration(
  tenantId: string,
  saasId: string,
  integrationKey: string,
): Promise<IntegrationConnection> {
  const existing = await getIntegrationConnection(tenantId, saasId, integrationKey);
  if (!existing) {
    throw new IntegrationCoreError("INTEGRATION_CONNECTION_NOT_FOUND");
  }

  const now = nowIso();
  await run(
    `UPDATE drako_integration_connections
     SET status = 'DISCONNECTED', last_error_code = NULL, last_error_message = NULL, updated_at = ?
     WHERE id = ?`,
    now,
    existing.id,
  );

  const updated = await getIntegrationConnection(tenantId, saasId, integrationKey);
  if (!updated) throw new IntegrationCoreError("INTEGRATION_CONNECTION_NOT_FOUND");
  return updated;
}

export async function listIntegrationConnections(filters?: {
  tenantId?: string | null;
  saasId?: string | null;
  integrationKey?: string | null;
}): Promise<IntegrationConnection[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.tenantId) {
    clauses.push("tenant_id = ?");
    params.push(filters.tenantId);
  }
  if (filters?.saasId) {
    clauses.push("saas_id = ?");
    params.push(filters.saasId);
  }
  if (filters?.integrationKey) {
    clauses.push("integration_key = ?");
    params.push(filters.integrationKey);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await queryAll<ConnectionRow>(
    `SELECT id, tenant_id, saas_id, integration_key, connection_label, status, metadata_json, last_validated_at, last_error_code, last_error_message, created_at, updated_at
     FROM drako_integration_connections
     ${where}
     ORDER BY datetime(updated_at) DESC`,
    ...params,
  );

  const credentials = await queryAll<CredentialRow>(
    `SELECT connection_id, credential_type, payload_json, created_at, updated_at
     FROM drako_integration_credentials`,
  );
  const credentialsByConnectionId = new Map(credentials.map((row) => [row.connection_id, row]));
  return rows.map((row) => mapConnection(row, credentialsByConnectionId.get(row.id) ?? null));
}

export async function updateIntegrationConnectionState(input: {
  tenantId: string;
  saasId: string;
  integrationKey: string;
  status: IntegrationConnection["status"];
  metadata?: Record<string, unknown> | null;
  checkedAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<IntegrationConnection> {
  const existing = await getIntegrationConnection(input.tenantId, input.saasId, input.integrationKey);
  if (!existing) {
    throw new IntegrationCoreError("INTEGRATION_CONNECTION_NOT_FOUND");
  }

  const now = nowIso();
  const nextMetadata = typeof input.metadata === "undefined" ? existing.metadata : input.metadata ?? null;

  await run(
    `UPDATE drako_integration_connections
     SET status = ?, metadata_json = ?, last_validated_at = ?, last_error_code = ?, last_error_message = ?, updated_at = ?
     WHERE id = ?`,
    input.status,
    stringifyJson(nextMetadata),
    input.checkedAt ?? existing.lastValidatedAt,
    input.errorCode ?? null,
    input.errorMessage ?? null,
    now,
    existing.id,
  );

  const updated = await getIntegrationConnection(input.tenantId, input.saasId, input.integrationKey);
  if (!updated) throw new IntegrationCoreError("INTEGRATION_CONNECTION_NOT_FOUND");
  return updated;
}
