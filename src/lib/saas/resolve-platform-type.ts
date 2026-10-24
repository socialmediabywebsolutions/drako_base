/**
 * saas/resolve-platform-type.ts
 *
 * Resolves the platform type for a given SaaS instance ID.
 *
 * platform_type is stored in saas_instances.platform_type and identifies
 * which software platform (handler) should process messages for this SaaS.
 *
 * This is the authoritative source for saasId → handler key resolution.
 * Used by the conversation router to dispatch inbound channel messages.
 */
import { queryOne } from "@/lib/db";
import { env as resolveEnv, type DracoEnv } from "@/lib/cf";

export const VALID_PLATFORM_TYPES = ["campamento-base", "mentoria", "socialflow"] as const;

export type PlatformType = (typeof VALID_PLATFORM_TYPES)[number];

export class PlatformTypeResolutionError extends Error {
  readonly code:
    | "PLATFORM_TYPE_DB_UNAVAILABLE"
    | "PLATFORM_TYPE_SAAS_NOT_FOUND"
    | "PLATFORM_TYPE_INVALID";

  constructor(
    code:
      | "PLATFORM_TYPE_DB_UNAVAILABLE"
      | "PLATFORM_TYPE_SAAS_NOT_FOUND"
      | "PLATFORM_TYPE_INVALID",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "PlatformTypeResolutionError";
    this.code = code;
  }
}

type PlatformTypeRow = {
  platform_type: string | null;
};

function isPlatformType(value: string): value is PlatformType {
  return (VALID_PLATFORM_TYPES as readonly string[]).includes(value);
}

/**
 * Resolves the platform type for a SaaS instance from the DB.
 *
 * Returns the validated platform_type value from saas_instances where id = saasId.
 * Throws PlatformTypeResolutionError when the DB is unavailable, the SaaS row
 * does not exist, or the stored value is invalid.
 */
export async function resolvePlatformTypeFromSaasId(
  saasId: string,
  env?: DracoEnv | null,
): Promise<PlatformType> {
  const runtimeEnv = env ?? resolveEnv();
  if (!runtimeEnv?.DRACO_DB) {
    throw new PlatformTypeResolutionError("PLATFORM_TYPE_DB_UNAVAILABLE");
  }

  try {
    const row = await queryOne<PlatformTypeRow>(
      `SELECT platform_type FROM saas_instances WHERE id = ? LIMIT 1`,
      saasId,
    );
    if (!row) {
      throw new PlatformTypeResolutionError("PLATFORM_TYPE_SAAS_NOT_FOUND");
    }

    const platformType = row.platform_type?.trim() ?? "";
    if (!platformType || !isPlatformType(platformType)) {
      throw new PlatformTypeResolutionError("PLATFORM_TYPE_INVALID");
    }

    return platformType;
  } catch (error) {
    if (error instanceof PlatformTypeResolutionError) {
      throw error;
    }
    throw new PlatformTypeResolutionError("PLATFORM_TYPE_DB_UNAVAILABLE");
  }
}
