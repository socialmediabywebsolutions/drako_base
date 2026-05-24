import { ensureDracoDb, queryOne } from "../../db/runtime-db";

export type RuntimeSocialSaasSeed = {
  id: string;
  slug: string;
  name: string;
  blueprint_snapshot: string | null;
};

const SOCIALFLOW_RUNTIME_SEED_SLUGS = ["socialflow", "socialflows"] as const;

export async function resolveRuntimeSocialSaasSeedContract(tenantId: string): Promise<RuntimeSocialSaasSeed | null> {
  // TODO(SocialFlow DB separation): replace this runtime seed core lookup with SOCIAL_DB-owned socialflow_seed_metadata or Campamento Base internal API.
  let db: D1Database;
  try {
    db = ensureDracoDb();
  } catch {
    return null;
  }

  try {
    return await queryOne<RuntimeSocialSaasSeed>(
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
