import type { DracoEnv } from "@/lib/cf";
import {
  isSocialFlowLegacyReadModelsSocialDbReadSwitchEnabled,
} from "@/lib/socialflow/contracts/legacy-actions-core";

export type SocialRepositoryContext = {
  tenantId: string;
  saasId: string | null;
  mode: "d1";
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

type ResolveLegacyRepositoryContextReadOptions = {
  tenantId: string;
  saasId: string;
  socialDb?: D1Database | null;
  coreRead: () => Promise<SocialFlowLegacyRepositoryContextReadModel | null>;
  runtimeEnv?: Record<string, unknown> | null;
  switchEnabled?: boolean;
};

function createD1Executor(db: D1Database): SocialFlowLegacyRepositorySocialOwnershipPrepExecutor {
  return {
    async queryOne<T>(sql: string, ...params: unknown[]) {
      const statement = db.prepare(sql);
      const bound = params.length > 0 ? statement.bind(...params) : statement;
      return bound.first<T>();
    },
    async run(sql: string, ...params: unknown[]) {
      const statement = db.prepare(sql);
      const bound = params.length > 0 ? statement.bind(...params) : statement;
      const result = await bound.run();
      return Boolean(result.success);
    },
  };
}

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

export async function resolveLegacyRepositoryContextReadModel(
  options: ResolveLegacyRepositoryContextReadOptions,
): Promise<SocialFlowLegacyRepositoryContextReadModel | null> {
  // TODO(SocialFlow DB separation): switch legacy actions/repository reads to SOCIAL_DB once switch smoke passes.
  const switchEnabled = options.switchEnabled
    ?? isSocialFlowLegacyReadModelsSocialDbReadSwitchEnabled(options.runtimeEnv);

  if (switchEnabled && options.socialDb) {
    try {
      const socialContract = createSocialFlowLegacyRepositorySocialOwnershipPrepContract(
        createD1Executor(options.socialDb),
      );
      const socialRow = await socialContract.getPreparedRepositoryContext(options.tenantId, options.saasId);
      if (socialRow) {
        return socialRow;
      }
    } catch {
      // Best-effort SOCIAL_DB read; fallback to core-backed path is required by design.
    }
  }

  return options.coreRead();
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
    socialDb: input.runtimeEnv.SOCIAL_DB,
    env: input.runtimeEnv,
  };
}
