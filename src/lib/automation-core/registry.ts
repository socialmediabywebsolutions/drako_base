import { queryAll, queryOne, run } from "@/lib/db";
import { generateId, normalizeConfig, nowIso, parseJsonObject, stringifyJson } from "@/lib/automation-core/shared";
import { AutomationCoreError, type AutomationRegistration, type ListAutomationsFilters, type RegisterAutomationInput } from "@/lib/automation-core/types";

type RegistrationRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  automation_key: string;
  display_name: string;
  description: string | null;
  enabled: number;
  schedule_mode: "manual" | "scheduled";
  frequency_unit: "hour" | "day" | "week" | null;
  frequency_value: number | null;
  config_json: string | null;
  owner_scope: "OWNER";
  created_at: string;
  updated_at: string;
};

function mapRegistration(row: RegistrationRow): AutomationRegistration {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    automationKey: row.automation_key,
    displayName: row.display_name,
    description: row.description ?? null,
    enabled: row.enabled === 1,
    scheduleMode: row.schedule_mode,
    frequencyUnit: row.frequency_unit ?? null,
    frequencyValue: row.frequency_value ?? null,
    config: parseJsonObject(row.config_json, null),
    ownerScope: row.owner_scope,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateRegisterInput(input: RegisterAutomationInput): void {
  if (!input.tenantId?.trim()) throw new AutomationCoreError("AUTOMATION_TENANT_REQUIRED");
  if (!input.saasId?.trim()) throw new AutomationCoreError("AUTOMATION_SAAS_REQUIRED");
  if (!input.automationKey?.trim()) throw new AutomationCoreError("AUTOMATION_KEY_REQUIRED");
  if (!input.displayName?.trim()) throw new AutomationCoreError("AUTOMATION_DISPLAY_NAME_REQUIRED");
  if (
    input.frequencyValue != null
    && (!Number.isInteger(input.frequencyValue) || input.frequencyValue <= 0)
  ) {
    throw new AutomationCoreError("AUTOMATION_FREQUENCY_INVALID");
  }
}

export async function getAutomation(
  tenantId: string,
  saasId: string,
  automationKey: string,
): Promise<AutomationRegistration | null> {
  const row = await queryOne<RegistrationRow>(
    `SELECT id, tenant_id, saas_id, automation_key, display_name, description, enabled, schedule_mode,
            frequency_unit, frequency_value, config_json, owner_scope, created_at, updated_at
     FROM drako_automation_registrations
     WHERE tenant_id = ? AND saas_id = ? AND automation_key = ?
     LIMIT 1`,
    tenantId,
    saasId,
    automationKey,
  );
  return row ? mapRegistration(row) : null;
}

export async function registerAutomation(input: RegisterAutomationInput): Promise<AutomationRegistration> {
  validateRegisterInput(input);

  const tenantId = input.tenantId.trim();
  const saasId = input.saasId.trim();
  const automationKey = input.automationKey.trim();
  const existing = await getAutomation(tenantId, saasId, automationKey);
  const now = nowIso();
  const description = input.description?.trim() || null;
  const displayName = input.displayName.trim();
  const enabled = input.enabled ?? existing?.enabled ?? true;
  const scheduleMode = input.scheduleMode ?? existing?.scheduleMode ?? "manual";
  const frequencyUnit =
    typeof input.frequencyUnit === "undefined" ? existing?.frequencyUnit ?? null : input.frequencyUnit;
  const frequencyValue =
    typeof input.frequencyValue === "undefined" ? existing?.frequencyValue ?? null : input.frequencyValue;
  const config =
    typeof input.config === "undefined"
      ? existing?.config ?? null
      : normalizeConfig(input.config);
  const ownerScope = input.ownerScope ?? existing?.ownerScope ?? "OWNER";

  if (existing) {
    await run(
      `UPDATE drako_automation_registrations
       SET display_name = ?, description = ?, enabled = ?, schedule_mode = ?, frequency_unit = ?,
           frequency_value = ?, config_json = ?, owner_scope = ?, updated_at = ?
       WHERE tenant_id = ? AND saas_id = ? AND automation_key = ?`,
      displayName,
      description,
      enabled ? 1 : 0,
      scheduleMode,
      frequencyUnit,
      frequencyValue,
      stringifyJson(config),
      ownerScope,
      now,
      tenantId,
      saasId,
      automationKey,
    );
    const updated = await getAutomation(tenantId, saasId, automationKey);
    if (updated) return updated;
  }

  const id = generateId("automation");
  await run(
    `INSERT INTO drako_automation_registrations (
      id, tenant_id, saas_id, automation_key, display_name, description, enabled, schedule_mode,
      frequency_unit, frequency_value, config_json, owner_scope, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    tenantId,
    saasId,
    automationKey,
    displayName,
    description,
    enabled ? 1 : 0,
    scheduleMode,
    frequencyUnit,
    frequencyValue,
    stringifyJson(config),
    ownerScope,
    now,
    now,
  );

  return {
    id,
    tenantId,
    saasId,
    automationKey,
    displayName,
    description,
    enabled,
    scheduleMode,
    frequencyUnit,
    frequencyValue,
    config,
    ownerScope,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setAutomationEnabled(
  tenantId: string,
  saasId: string,
  automationKey: string,
  enabled: boolean,
): Promise<AutomationRegistration> {
  const existing = await getAutomation(tenantId, saasId, automationKey);
  if (!existing) {
    throw new AutomationCoreError("AUTOMATION_NOT_REGISTERED");
  }

  const updatedAt = nowIso();
  await run(
    `UPDATE drako_automation_registrations
     SET enabled = ?, updated_at = ?
     WHERE tenant_id = ? AND saas_id = ? AND automation_key = ?`,
    enabled ? 1 : 0,
    updatedAt,
    tenantId,
    saasId,
    automationKey,
  );

  return {
    ...existing,
    enabled,
    updatedAt,
  };
}

export async function enableAutomation(
  tenantId: string,
  saasId: string,
  automationKey: string,
): Promise<AutomationRegistration> {
  return setAutomationEnabled(tenantId, saasId, automationKey, true);
}

export async function disableAutomation(
  tenantId: string,
  saasId: string,
  automationKey: string,
): Promise<AutomationRegistration> {
  return setAutomationEnabled(tenantId, saasId, automationKey, false);
}

export async function listAutomations(filters?: ListAutomationsFilters): Promise<AutomationRegistration[]> {
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
  if (filters?.automationKey) {
    clauses.push("automation_key = ?");
    params.push(filters.automationKey);
  }
  if (typeof filters?.enabled === "boolean") {
    clauses.push("enabled = ?");
    params.push(filters.enabled ? 1 : 0);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await queryAll<RegistrationRow>(
    `SELECT id, tenant_id, saas_id, automation_key, display_name, description, enabled, schedule_mode,
            frequency_unit, frequency_value, config_json, owner_scope, created_at, updated_at
     FROM drako_automation_registrations
     ${where}
     ORDER BY datetime(updated_at) DESC`,
    ...params,
  );

  return rows.map(mapRegistration);
}
