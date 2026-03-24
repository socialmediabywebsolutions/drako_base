import { getDb } from "@/lib/db";

export type CampoBaseSocialAutomationRegistryItem = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UpsertCampoBaseSocialAutomationRegistryInput = {
  tenantId: string;
  saasId: string;
  niche: string;
  tone: string;
  frequencyPerWeek: number;
  enabled?: boolean;
};

type RegistryRow = {
  tenant_id: string;
  saas_id: string;
  niche: string;
  tone: string;
  frequency_per_week: number;
  enabled: number;
  created_at: string;
  updated_at: string;
};

const TABLE_NAME = "campobase_social_automation_registry";
let schemaReady: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function mapRow(row: RegistryRow): CampoBaseSocialAutomationRegistryItem {
  return {
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    niche: row.niche,
    tone: row.tone,
    frequencyPerWeek: row.frequency_per_week,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          tenant_id TEXT NOT NULL,
          saas_id TEXT NOT NULL,
          niche TEXT NOT NULL,
          tone TEXT NOT NULL,
          frequency_per_week INTEGER NOT NULL,
          enabled INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (tenant_id, saas_id)
        )`,
      ).run();
      await db.prepare(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_${TABLE_NAME}_unique ON ${TABLE_NAME} (tenant_id, saas_id)`,
      ).run();
      await db.prepare(
        `CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_enabled_updated ON ${TABLE_NAME} (enabled, updated_at)`,
      ).run();
    })();
  }

  await schemaReady;
}

async function queryRows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all<T>();
  return res.results ?? [];
}

async function queryRow<T>(sql: string, ...params: unknown[]): Promise<T | null> {
  const rows = await queryRows<T>(sql, ...params);
  return rows[0] ?? null;
}

async function runStatement(sql: string, ...params: unknown[]): Promise<void> {
  const db = getDb();
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  await bound.run();
}

export async function upsertCampoBaseSocialAutomationRegistry(
  input: UpsertCampoBaseSocialAutomationRegistryInput,
): Promise<CampoBaseSocialAutomationRegistryItem> {
  await ensureSchema();
  const existing = await queryRow<RegistryRow>(
    `SELECT tenant_id, saas_id, niche, tone, frequency_per_week, enabled, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    input.tenantId,
    input.saasId,
  );
  const now = nowIso();
  const createdAt = existing?.created_at ?? now;
  const enabled = input.enabled ?? (existing ? existing.enabled === 1 : true);

  await runStatement(
    `INSERT INTO ${TABLE_NAME} (tenant_id, saas_id, niche, tone, frequency_per_week, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, saas_id)
     DO UPDATE SET niche = excluded.niche,
                  tone = excluded.tone,
                  frequency_per_week = excluded.frequency_per_week,
                  enabled = excluded.enabled,
                  updated_at = excluded.updated_at`,
    input.tenantId,
    input.saasId,
    input.niche,
    input.tone,
    input.frequencyPerWeek,
    enabled ? 1 : 0,
    createdAt,
    now,
  );

  const updated = await queryRow<RegistryRow>(
    `SELECT tenant_id, saas_id, niche, tone, frequency_per_week, enabled, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    input.tenantId,
    input.saasId,
  );

  if (updated) {
    return mapRow(updated);
  }

  return {
    tenantId: input.tenantId,
    saasId: input.saasId,
    niche: input.niche,
    tone: input.tone,
    frequencyPerWeek: input.frequencyPerWeek,
    enabled,
    createdAt,
    updatedAt: now,
  };
}

export async function getCampoBaseSocialAutomationRegistryItem(
  tenantId: string,
  saasId: string,
): Promise<CampoBaseSocialAutomationRegistryItem | null> {
  await ensureSchema();
  const row = await queryRow<RegistryRow>(
    `SELECT tenant_id, saas_id, niche, tone, frequency_per_week, enabled, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    tenantId,
    saasId,
  );
  return row ? mapRow(row) : null;
}

export async function listCampoBaseSocialAutomationRegistryItems(): Promise<CampoBaseSocialAutomationRegistryItem[]> {
  await ensureSchema();
  const rows = await queryRows<RegistryRow>(
    `SELECT tenant_id, saas_id, niche, tone, frequency_per_week, enabled, created_at, updated_at
     FROM ${TABLE_NAME}
     ORDER BY datetime(updated_at) DESC`,
  );
  return rows.map(mapRow);
}

export async function listEnabledCampoBaseSocialAutomationRegistryItems(): Promise<CampoBaseSocialAutomationRegistryItem[]> {
  await ensureSchema();
  const rows = await queryRows<RegistryRow>(
    `SELECT tenant_id, saas_id, niche, tone, frequency_per_week, enabled, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE enabled = 1
     ORDER BY datetime(updated_at) DESC`,
  );
  return rows.map(mapRow);
}

export async function setCampoBaseSocialAutomationEnabled(
  tenantId: string,
  saasId: string,
  enabled: boolean,
): Promise<CampoBaseSocialAutomationRegistryItem | null> {
  await ensureSchema();
  const existing = await queryRow<RegistryRow>(
    `SELECT tenant_id, saas_id, niche, tone, frequency_per_week, enabled, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    tenantId,
    saasId,
  );

  if (!existing) {
    return null;
  }

  const updatedAt = nowIso();
  await runStatement(
    `UPDATE ${TABLE_NAME}
     SET enabled = ?, updated_at = ?
     WHERE tenant_id = ? AND saas_id = ?`,
    enabled ? 1 : 0,
    updatedAt,
    tenantId,
    saasId,
  );

  return {
    tenantId: existing.tenant_id,
    saasId: existing.saas_id,
    niche: existing.niche,
    tone: existing.tone,
    frequencyPerWeek: existing.frequency_per_week,
    enabled,
    createdAt: existing.created_at,
    updatedAt,
  };
}

export async function removeCampoBaseSocialAutomationRegistryItem(
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  await ensureSchema();
  const existing = await queryRow<RegistryRow>(
    `SELECT tenant_id
     FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ?
     LIMIT 1`,
    tenantId,
    saasId,
  );

  if (!existing) {
    return false;
  }

  await runStatement(
    `DELETE FROM ${TABLE_NAME}
     WHERE tenant_id = ? AND saas_id = ?`,
    tenantId,
    saasId,
  );

  return true;
}
