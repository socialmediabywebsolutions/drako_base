import * as runtimeDb from "../../db/runtime-db";
import { getCloudflareContextSafeSync } from "@/lib/cloudflare/runtime";
import {
  getSocialFlowRuntimeEnv,
  SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH_ENV_KEY,
} from "../../runtime-env";

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
const ENSURE_SOCIAL_DB_EXPORT_KEY = ["ensure", "Social", "Db"].join("");
const RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = false;

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
       WHERE tenant_id = ?
         AND lower(slug) IN (?, ?)
         AND lower(coalesce(status, '')) = 'active'
       ORDER BY datetime(updated_at) DESC, rowid DESC
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
  if (RUNTIME_SEED_SOCIAL_DB_READ_SWITCH) {
    return true;
  }

  const directContextEnvValue = (
    getCloudflareContextSafeSync() as { env?: Record<string, unknown> } | null
  )?.env?.[SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH_ENV_KEY];
  const runtimeEnvValue = (getSocialFlowRuntimeEnv() as Record<string, unknown> | null)?.[
    SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH_ENV_KEY
  ];
  const processEnvValue = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH_ENV_KEY
  ];

  const rawValue = typeof directContextEnvValue === "string"
    ? directContextEnvValue
    : typeof directContextEnvValue === "number"
      ? String(directContextEnvValue)
      : typeof directContextEnvValue === "boolean"
        ? (directContextEnvValue ? "1" : "0")
        : typeof runtimeEnvValue === "string"
          ? runtimeEnvValue
          : typeof runtimeEnvValue === "number"
            ? String(runtimeEnvValue)
            : typeof runtimeEnvValue === "boolean"
              ? (runtimeEnvValue ? "1" : "0")
              : typeof processEnvValue === "string"
                ? processEnvValue
                : "";
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

export async function resolveRuntimeSocialSaasSeedContract(tenantId: string): Promise<RuntimeSocialSaasSeed | null> {
  if (!isRuntimeSeedSocialDbReadEnabled()) {
    return null;
  }

  return resolveRuntimeSeedFromSocialDb(tenantId);
}
