import type { DracoEnv } from "@/lib/cf";

export type SocialRepositoryContext = {
  tenantId: string;
  saasId: string | null;
  mode: "d1";
  coreDb?: D1Database;
  socialDb: D1Database;
  env?: DracoEnv | null;
};

export type SocialFlowLegacyRepositoryContextReadModel = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string | null;
  status: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

type SocialFlowLegacyRepositorySocialOwnershipPrepExecutor = {
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  run: (sql: string, ...params: unknown[]) => Promise<boolean>;
};

export function createSocialFlowLegacyRepositorySocialOwnershipPrepContract(
  executor: SocialFlowLegacyRepositorySocialOwnershipPrepExecutor,
) {
  // TODO(SocialFlow DB separation): switch legacy actions/repository reads to SOCIAL_DB once backfill + parity checks pass.
  return {
    async getPreparedRepositoryContext(
      tenantId: string,
      saasId: string,
    ): Promise<SocialFlowLegacyRepositoryContextReadModel | null> {
      return executor.queryOne<SocialFlowLegacyRepositoryContextReadModel>(
        `SELECT
           id,
           tenant_id,
           saas_id,
           slug,
           domain,
           status,
           metadata_json,
           created_at,
           updated_at
         FROM socialflow_legacy_repository_context
         WHERE tenant_id = ? AND saas_id = ?
         ORDER BY datetime(updated_at) DESC, rowid DESC
         LIMIT 1`,
        tenantId,
        saasId,
      );
    },

    async upsertPreparedRepositoryContext(input: {
      id: string;
      tenantId: string;
      saasId: string;
      slug: string;
      domain: string | null;
      status: string;
      metadataJson: string;
    }): Promise<void> {
      const success = await executor.run(
        `INSERT INTO socialflow_legacy_repository_context (
           id,
           tenant_id,
           saas_id,
           slug,
           domain,
           status,
           metadata_json,
           created_at,
           updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
         ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
           slug = excluded.slug,
           domain = excluded.domain,
           status = excluded.status,
           metadata_json = excluded.metadata_json,
           updated_at = excluded.updated_at`,
        input.id,
        input.tenantId,
        input.saasId,
        input.slug,
        input.domain,
        input.status,
        input.metadataJson,
      );
      if (!success) {
        throw new Error("SOCIALFLOW_LEGACY_REPOSITORY_CONTEXT_PREP_UPSERT_FAILED");
      }
    },
  };
}

export function createSocialRepositoryContextWithCoreProjection(input: {
  tenantId: string;
  saasId: string | null;
  runtimeEnv: DracoEnv & { SOCIAL_DB: D1Database };
}): SocialRepositoryContext {
  // TODO(SocialFlow DB separation): replace this legacy core-backed adapter with SOCIAL_DB-owned data or Campamento Base internal API.
  return {
    tenantId: input.tenantId,
    saasId: input.saasId,
    mode: "d1",
    coreDb: input.runtimeEnv.DRACO_DB,
    socialDb: input.runtimeEnv.SOCIAL_DB,
    env: input.runtimeEnv,
  };
}
