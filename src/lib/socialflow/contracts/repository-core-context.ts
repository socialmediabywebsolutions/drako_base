import type { DracoEnv } from "@/lib/cf";

export type SocialRepositoryContext = {
  tenantId: string;
  saasId: string | null;
  mode: "d1";
  coreDb?: D1Database;
  socialDb: D1Database;
  env?: DracoEnv | null;
};

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
