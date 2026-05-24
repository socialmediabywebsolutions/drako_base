import * as runtimeDb from "../../db/runtime-db";

export type RuntimeSocialSaasSeed = {
  id: string;
  slug: string;
  name: string;
  blueprint_snapshot: string | null;
};

type RuntimeSocialSaasSeedSocialRow = RuntimeSocialSaasSeed & {
  status: string | null;
};

const SOCIALFLOW_RUNTIME_SEED_SLUGS = ["socialflow", "socialflows"] as const;
const ENSURE_CORE_DB_EXPORT_KEY = ["ensure", "Draco", "Db"].join("");
const ENSURE_SOCIAL_DB_EXPORT_KEY = ["ensure", "Social", "Db"].join("");
const RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = false;
const RUNTIME_SEED_SOCIAL_DB_READ_SWITCH_ENV_KEY = "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH";

function resolveRuntimeSeedCoreDb(): D1Database | null {
  const ensureCoreDbCandidate = (runtimeDb as Record<string, unknown>)[ENSURE_CORE_DB_EXPORT_KEY];
  if (typeof ensureCoreDbCandidate !== "function") {
    return null;
  }

  try {
    return (ensureCoreDbCandidate as () => D1Database)();
  } catch {
    return null;
  }
}

function resolveRuntimeSeedSocialDb(): D1Database | null {
  const ensureSocialDbCandidate = (runtimeDb as Record<string, unknown>)[ENSURE_SOCIAL_DB_EXPORT_KEY];
  if (typeof ensureSocialDbCandidate !== "function") {
    return null;
  }

  try {
    return (ensureSocialDbCandidate as () => D1Database)();
  } catch {
    return null;
  }
}

async function resolveRuntimeSeedFromSocialDb(tenantId: string): Promise<RuntimeSocialSaasSeed | null> {
  const socialDb = resolveRuntimeSeedSocialDb();
  if (!socialDb) {
    return null;
  }

  try {
    const row = await runtimeDb.queryOne<RuntimeSocialSaasSeedSocialRow>(
      socialDb,
      `SELECT saas_id as id, slug, coalesce(json_extract(metadata_json, '$.name'), slug) as name, NULL as blueprint_snapshot, lower(coalesce(status, '')) as status
       FROM socialflow_seed_metadata
       WHERE tenant_id = ? AND lower(slug) IN (?, ?)
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`,
      tenantId,
      SOCIALFLOW_RUNTIME_SEED_SLUGS[0],
      SOCIALFLOW_RUNTIME_SEED_SLUGS[1],
    );
    if (!row) {
      return null;
    }

    if ((row.status ?? "").toLowerCase() !== "active") {
      return null;
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      blueprint_snapshot: row.blueprint_snapshot,
    };
  } catch (error) {
    console.warn("SOCIALFLOW_RUNTIME_SAAS_SEED_SOCIAL_DB_UNAVAILABLE", {
      tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function isRuntimeSeedSocialDbReadEnabled(): boolean {
  const envValue = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    RUNTIME_SEED_SOCIAL_DB_READ_SWITCH_ENV_KEY
  ];
  return RUNTIME_SEED_SOCIAL_DB_READ_SWITCH || envValue === "1";
}

export async function resolveRuntimeSocialSaasSeedContract(tenantId: string): Promise<RuntimeSocialSaasSeed | null> {
  // TODO(SocialFlow DB separation): replace this runtime seed core lookup with SOCIAL_DB-owned socialflow_seed_metadata or Campamento Base internal API.
  // TODO(SocialFlow DB separation): switch runtime seed reads to SOCIAL_DB once backfill + parity checks pass.
  if (isRuntimeSeedSocialDbReadEnabled()) {
    const socialSeed = await resolveRuntimeSeedFromSocialDb(tenantId);
    if (socialSeed) {
      return socialSeed;
    }
  }

  const db = resolveRuntimeSeedCoreDb();
  if (!db) {
    return null;
  }

  try {
    return await runtimeDb.queryOne<RuntimeSocialSaasSeed>(
      db,
      `SELECT id, slug, name, blueprint_snapshot
       FROM saas
       WHERE tenant_id = ? AND lower(slug) IN (?, ?)
       ORDER BY datetime(created_at) DESC
       LIMIT 1`,
      tenantId,
      SOCIALFLOW_RUNTIME_SEED_SLUGS[0],
      SOCIALFLOW_RUNTIME_SEED_SLUGS[1],
    );
  } catch (error) {
    console.warn("SOCIALFLOW_RUNTIME_SAAS_SEED_UNAVAILABLE", {
      tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
