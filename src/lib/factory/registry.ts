import { queryAll, queryOne, run } from "@/lib/db";

export type FactorySaasStatus = "ACTIVE" | "DISABLED" | "DEGRADED" | "ARCHIVED";

export type FactorySaasMetadata = Record<string, unknown> | null;

export type FactorySaasRecord = {
  saasId: string;
  displayName: string;
  template: string | null;
  status: FactorySaasStatus;
  createdBy: string | null;
  supportsOperatorSurface: boolean;
  metadata: FactorySaasMetadata;
  createdAt: string;
  updatedAt: string;
};

export type RegisterFactorySaasInput = {
  saasId: string;
  displayName: string;
  template?: string | null;
  status?: FactorySaasStatus;
  createdBy?: string | null;
  supportsOperatorSurface?: boolean;
  metadata?: FactorySaasMetadata;
};

type FactorySaasRow = {
  saas_id: string;
  display_name: string;
  template: string | null;
  status: FactorySaasStatus;
  created_by: string | null;
  supports_operator_surface: number;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseMetadata(value: string | null): FactorySaasMetadata {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function stringifyMetadata(metadata: FactorySaasMetadata): string | null {
  return metadata ? JSON.stringify(metadata) : null;
}

function mapFactorySaas(row: FactorySaasRow): FactorySaasRecord {
  return {
    saasId: row.saas_id,
    displayName: row.display_name,
    template: row.template ?? null,
    status: row.status,
    createdBy: row.created_by ?? null,
    supportsOperatorSurface: row.supports_operator_surface === 1,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateStatus(status: string): asserts status is FactorySaasStatus {
  if (!["ACTIVE", "DISABLED", "DEGRADED", "ARCHIVED"].includes(status)) {
    throw new Error("FACTORY_SAAS_STATUS_INVALID");
  }
}

function validateIdentity(input: { saasId: string; displayName?: string | null }) {
  if (!input.saasId?.trim()) {
    throw new Error("FACTORY_SAAS_ID_REQUIRED");
  }
  if (typeof input.displayName !== "undefined" && !input.displayName?.trim()) {
    throw new Error("FACTORY_SAAS_DISPLAY_NAME_REQUIRED");
  }
}

export async function getFactorySaas(saasId: string): Promise<FactorySaasRecord | null> {
  validateIdentity({ saasId });
  const row = await queryOne<FactorySaasRow>(
    `SELECT saas_id, display_name, template, status, created_by, supports_operator_surface, metadata_json, created_at, updated_at
     FROM drako_factory_saas_registry
     WHERE saas_id = ?
     LIMIT 1`,
    saasId.trim(),
  );
  return row ? mapFactorySaas(row) : null;
}

export async function listFactorySaas(filters?: {
  status?: FactorySaasStatus | null;
}): Promise<FactorySaasRecord[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (filters?.status) {
    validateStatus(filters.status);
    clauses.push("status = ?");
    params.push(filters.status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = await queryAll<FactorySaasRow>(
    `SELECT saas_id, display_name, template, status, created_by, supports_operator_surface, metadata_json, created_at, updated_at
     FROM drako_factory_saas_registry
     ${where}
     ORDER BY datetime(updated_at) DESC`,
    ...params,
  );
  return rows.map(mapFactorySaas);
}

export async function registerFactorySaas(input: RegisterFactorySaasInput): Promise<FactorySaasRecord> {
  validateIdentity(input);

  const saasId = input.saasId.trim();
  const displayName = input.displayName!.trim();
  const existing = await getFactorySaas(saasId);
  const now = nowIso();
  const template = typeof input.template === "undefined" ? existing?.template ?? null : input.template ?? null;
  const status = input.status ?? existing?.status ?? "ACTIVE";
  validateStatus(status);
  const createdBy = typeof input.createdBy === "undefined" ? existing?.createdBy ?? null : input.createdBy ?? null;
  const supportsOperatorSurface = typeof input.supportsOperatorSurface === "boolean"
    ? input.supportsOperatorSurface
    : existing?.supportsOperatorSurface ?? false;
  const metadata = typeof input.metadata === "undefined" ? existing?.metadata ?? null : input.metadata ?? null;

  if (existing) {
    await run(
      `UPDATE drako_factory_saas_registry
       SET display_name = ?, template = ?, status = ?, created_by = ?, supports_operator_surface = ?, metadata_json = ?, updated_at = ?
       WHERE saas_id = ?`,
      displayName,
      template,
      status,
      createdBy,
      supportsOperatorSurface ? 1 : 0,
      stringifyMetadata(metadata),
      now,
      saasId,
    );
  } else {
    await run(
      `INSERT INTO drako_factory_saas_registry (
        saas_id, display_name, template, status, created_by, supports_operator_surface, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      saasId,
      displayName,
      template,
      status,
      createdBy,
      supportsOperatorSurface ? 1 : 0,
      stringifyMetadata(metadata),
      now,
      now,
    );
  }

  const persisted = await getFactorySaas(saasId);
  if (!persisted) {
    throw new Error("FACTORY_SAAS_REGISTRY_PERSIST_FAILED");
  }

  return persisted;
}

export async function setFactorySaasStatus(saasId: string, status: FactorySaasStatus): Promise<FactorySaasRecord> {
  validateIdentity({ saasId });
  validateStatus(status);

  const existing = await getFactorySaas(saasId);
  if (!existing) {
    throw new Error("FACTORY_SAAS_NOT_FOUND");
  }

  const now = nowIso();
  await run(
    `UPDATE drako_factory_saas_registry
     SET status = ?, updated_at = ?
     WHERE saas_id = ?`,
    status,
    now,
    saasId.trim(),
  );

  const updated = await getFactorySaas(saasId);
  if (!updated) {
    throw new Error("FACTORY_SAAS_NOT_FOUND");
  }

  return updated;
}

export async function archiveFactorySaas(saasId: string): Promise<FactorySaasRecord> {
  return setFactorySaasStatus(saasId, "ARCHIVED");
}
