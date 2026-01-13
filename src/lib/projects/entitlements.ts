import { queryOne as queryOneDb, run as runDb } from "@/lib/db";

export type ProjectEntitlementsRow = {
  tenant_id: string;
  project_id: string;
  packs_json: string;
  features_json: string;
  limits_json: string;
  metadata_json: string | null;
  updated_at: string;
};

export type NormalizedProjectEntitlements = {
  enabledFeatures: string[];
  enabledPacks: string[];
  limits: Record<string, number>;
  metadata: Record<string, unknown> | null;
  updatedAt: string | null;
};

type QueryOneFn = <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
type RunFn = (sql: string, ...params: unknown[]) => Promise<boolean>;

type DbAdapter = {
  queryOne: QueryOneFn;
  run: RunFn;
};

const defaultDb: DbAdapter = {
  queryOne: queryOneDb,
  run: runDb,
};

function resolveDbAdapter(adapter?: Partial<DbAdapter>): DbAdapter {
  if (!adapter) return defaultDb;
  return {
    queryOne: adapter.queryOne ?? defaultDb.queryOne,
    run: adapter.run ?? defaultDb.run,
  };
}

export function normalizeStringArray(value: unknown, options?: { lowercase?: boolean }): string[] {
  if (!value) return [];

  const toLower = options?.lowercase ?? false;
  const asArray = Array.isArray(value) ? value : [value];

  const normalized = asArray
    .filter((item): item is string => typeof item === "string")
    .map((item) => (toLower ? item.trim().toLowerCase() : item.trim()))
    .filter((item) => item.length > 0);

  const deduped = Array.from(new Set(normalized));
  return deduped.sort((a, b) => a.localeCompare(b));
}

export function normalizeLimits(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const key = rawKey.trim();
    if (!key) continue;

    let numeric: number | null = null;
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      numeric = rawValue;
    } else if (typeof rawValue === "string") {
      const parsed = Number(rawValue);
      if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
        numeric = parsed;
      }
    }

    if (numeric === null || numeric < 0) {
      continue;
    }

    result[key] = numeric;
  }

  return result;
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  try {
    JSON.stringify(value);
  } catch (error) {
    console.warn("PROJECT_ENTITLEMENTS_METADATA_INVALID", error);
    return null;
  }
  return value as Record<string, unknown>;
}

export async function getProjectEntitlements(
  params: { tenantId: string; projectId: string },
  adapter?: Partial<DbAdapter>,
): Promise<NormalizedProjectEntitlements> {
  const db = resolveDbAdapter(adapter);
  const tenantId = params.tenantId.trim();
  const projectId = params.projectId.trim();
  if (!tenantId) throw new Error("tenantId es obligatorio");
  if (!projectId) throw new Error("projectId es obligatorio");

  const row = await db.queryOne<ProjectEntitlementsRow>(
    `SELECT tenant_id, project_id, packs_json, features_json, limits_json, metadata_json, updated_at
     FROM project_entitlements
     WHERE tenant_id = ? AND project_id = ?
     LIMIT 1`,
    tenantId,
    projectId,
  );

  return deserializeRow(row);
}

export async function upsertProjectEntitlements(
  params: {
    tenantId: string;
    projectId: string;
    entitlements: {
      enabledFeatures?: unknown;
      enabledPacks?: unknown;
      limits?: unknown;
      metadata?: unknown;
    };
  },
  adapter?: Partial<DbAdapter>,
): Promise<NormalizedProjectEntitlements> {
  const db = resolveDbAdapter(adapter);
  const tenantId = params.tenantId.trim();
  const projectId = params.projectId.trim();
  if (!tenantId) throw new Error("tenantId es obligatorio");
  if (!projectId) throw new Error("projectId es obligatorio");

  const enabledFeatures = normalizeStringArray(params.entitlements.enabledFeatures ?? [], { lowercase: true });
  const enabledPacks = normalizeStringArray(params.entitlements.enabledPacks ?? [], { lowercase: true });
  const limits = normalizeLimits(params.entitlements.limits ?? {});
  const metadata = normalizeMetadata(params.entitlements.metadata ?? null);
  const now = new Date().toISOString();

  const success = await db.run(
    `INSERT INTO project_entitlements (tenant_id, project_id, packs_json, features_json, limits_json, metadata_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, project_id) DO UPDATE SET
       packs_json = excluded.packs_json,
       features_json = excluded.features_json,
       limits_json = excluded.limits_json,
       metadata_json = excluded.metadata_json,
       updated_at = excluded.updated_at`,
    tenantId,
    projectId,
    JSON.stringify(enabledPacks),
    JSON.stringify(enabledFeatures),
    JSON.stringify(limits),
    metadata ? JSON.stringify(metadata) : null,
    now,
  );

  if (!success) {
    throw new Error("No se pudo actualizar los entitlements del proyecto");
  }

  return {
    enabledFeatures,
    enabledPacks,
    limits,
    metadata,
    updatedAt: now,
  };
}

function deserializeRow(row: ProjectEntitlementsRow | null): NormalizedProjectEntitlements {
  if (!row) {
    return {
      enabledFeatures: [],
      enabledPacks: [],
      limits: {},
      metadata: null,
      updatedAt: null,
    };
  }

  const packs = safeParseArray(row.packs_json);
  const features = safeParseArray(row.features_json);
  const limits = safeParseLimits(row.limits_json);
  const metadata = safeParseMetadata(row.metadata_json);

  return {
    enabledFeatures: normalizeStringArray(features, { lowercase: true }),
    enabledPacks: normalizeStringArray(packs, { lowercase: true }),
    limits,
    metadata,
    updatedAt: row.updated_at ?? null,
  };
}

function safeParseArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch (error) {
    console.warn("PROJECT_ENTITLEMENTS_PARSE_ERROR", error);
    return [];
  }
}

function safeParseLimits(value: string | null | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return normalizeLimits(parsed);
  } catch (error) {
    console.warn("PROJECT_ENTITLEMENTS_LIMITS_PARSE_ERROR", error);
    return {};
  }
}

function safeParseMetadata(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return normalizeMetadata(parsed);
  } catch (error) {
    console.warn("PROJECT_ENTITLEMENTS_METADATA_PARSE_ERROR", error);
    return null;
  }
}
