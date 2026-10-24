import { queryAll, queryOne, run } from "@/lib/db";
import { generateId, nowIso, parseJsonObject, stringifyJson } from "@/lib/integration-core/shared";
import {
  IntegrationCoreError,
  type IntegrationDefinition,
  type RegisterIntegrationDefinitionInput,
} from "@/lib/integration-core/types";

type DefinitionRow = {
  id: string;
  integration_key: string;
  display_name: string;
  provider: string;
  category: string;
  auth_mode: string;
  enabled: number;
  supported_operations_json: string | null;
  created_at: string;
  updated_at: string;
};

function mapDefinition(row: DefinitionRow): IntegrationDefinition {
  return {
    id: row.id,
    integrationKey: row.integration_key,
    displayName: row.display_name,
    provider: row.provider,
    category: row.category as IntegrationDefinition["category"],
    authMode: row.auth_mode as IntegrationDefinition["authMode"],
    enabled: row.enabled === 1,
    supportedOperations: parseJsonObject<string[]>(row.supported_operations_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateDefinitionInput(input: RegisterIntegrationDefinitionInput) {
  if (!input.integrationKey?.trim()) throw new IntegrationCoreError("INTEGRATION_KEY_REQUIRED");
  if (!input.displayName?.trim()) throw new IntegrationCoreError("INTEGRATION_DISPLAY_NAME_REQUIRED");
  if (!input.provider?.trim()) throw new IntegrationCoreError("INTEGRATION_PROVIDER_REQUIRED");
  if (!Array.isArray(input.supportedOperations) || input.supportedOperations.length === 0) {
    throw new IntegrationCoreError("INTEGRATION_OPERATIONS_REQUIRED");
  }
}

export async function getIntegrationDefinition(integrationKey: string): Promise<IntegrationDefinition | null> {
  const row = await queryOne<DefinitionRow>(
    `SELECT id, integration_key, display_name, provider, category, auth_mode, enabled, supported_operations_json, created_at, updated_at
     FROM drako_integration_definitions
     WHERE integration_key = ?
     LIMIT 1`,
    integrationKey,
  );
  return row ? mapDefinition(row) : null;
}

export async function registerIntegrationDefinition(
  input: RegisterIntegrationDefinitionInput,
): Promise<IntegrationDefinition> {
  validateDefinitionInput(input);
  const integrationKey = input.integrationKey.trim();
  const existing = await getIntegrationDefinition(integrationKey);
  const now = nowIso();
  const displayName = input.displayName.trim();
  const provider = input.provider.trim();
  const enabled = input.enabled ?? existing?.enabled ?? true;
  const supportedOperations = Array.from(
    new Set(input.supportedOperations.map((value) => value.trim()).filter(Boolean)),
  );

  if (existing) {
    await run(
      `UPDATE drako_integration_definitions
       SET display_name = ?, provider = ?, category = ?, auth_mode = ?, enabled = ?, supported_operations_json = ?, updated_at = ?
       WHERE integration_key = ?`,
      displayName,
      provider,
      input.category,
      input.authMode,
      enabled ? 1 : 0,
      stringifyJson(supportedOperations),
      now,
      integrationKey,
    );
    const updated = await getIntegrationDefinition(integrationKey);
    if (updated) return updated;
  }

  const id = generateId("integration");
  await run(
    `INSERT INTO drako_integration_definitions (
      id, integration_key, display_name, provider, category, auth_mode, enabled, supported_operations_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    integrationKey,
    displayName,
    provider,
    input.category,
    input.authMode,
    enabled ? 1 : 0,
    stringifyJson(supportedOperations),
    now,
    now,
  );

  return {
    id,
    integrationKey,
    displayName,
    provider,
    category: input.category,
    authMode: input.authMode,
    enabled,
    supportedOperations,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listIntegrationDefinitions(): Promise<IntegrationDefinition[]> {
  const rows = await queryAll<DefinitionRow>(
    `SELECT id, integration_key, display_name, provider, category, auth_mode, enabled, supported_operations_json, created_at, updated_at
     FROM drako_integration_definitions
     ORDER BY display_name ASC`,
  );
  return rows.map(mapDefinition);
}
