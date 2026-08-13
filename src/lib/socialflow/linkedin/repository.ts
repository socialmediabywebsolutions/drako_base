import {
  createSocialFlowLinkedInOAuthSocialOwnershipPrepContract,
  emitLinkedInOAuthActivity,
  saveLinkedInConnection,
  validateLinkedInConnection,
} from "@/lib/socialflow/contracts/linkedin-oauth-runtime";
import { env as resolveCfEnv } from "@/lib/cf";
import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialAccount } from "@/lib/socialflow/repository";
import type { SaasSocialAccount } from "@/lib/social-core/types";
import { encryptToken } from "@/lib/socialflow/token-encryption";
import type {
  LinkedInResolvedIdentity,
  LinkedInResolvedOrganization,
  LinkedInTokenResponse,
  LinkedInUserProfile,
} from "@/lib/socialflow/linkedin/core";

type PersistLinkedInConnectionInput = {
  tenantId: string;
  saasId: string;
  token: LinkedInTokenResponse;
  profile: LinkedInUserProfile;
  identity: LinkedInResolvedIdentity;
  organization?: LinkedInResolvedOrganization | null;
};

export type PersistLinkedInConnectionResult = {
  account: SaasSocialAccount;
  status: "persisted" | "updated";
};

type CoreProjectionResult = {
  existedBefore: boolean;
  validation: {
    ok: boolean;
    status: string;
    checkedAt?: string;
    error?: {
      code?: string;
      message?: string;
    } | null;
  };
};

const RUNTIME_LINKEDIN_OAUTH_SOCIAL_DB_PREP_WRITE_SWITCH = false;
const SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_PREP_WRITE_SWITCH_ENV_KEY = "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_PREP_WRITE_SWITCH";
const RUNTIME_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = false;
const SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH_ENV_KEY = "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH";

function normalizeSwitchValue(value: unknown): string {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).trim().toLowerCase();
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return "";
}

function isTruthySwitchValue(value: unknown): boolean {
  return ["1", "true", "on", "yes"].includes(normalizeSwitchValue(value));
}

function isLinkedInOAuthSocialOwnershipPrepWriteEnabled(): boolean {
  if (RUNTIME_LINKEDIN_OAUTH_SOCIAL_DB_PREP_WRITE_SWITCH) {
    return true;
  }

  return isTruthySwitchValue(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
      SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_PREP_WRITE_SWITCH_ENV_KEY
    ],
  );
}

function isLinkedInOAuthSocialDbReadEnabled(): boolean {
  if (RUNTIME_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH) {
    return true;
  }

  const bindings = resolveCfEnv() as Record<string, unknown> | null;
  const bindingSwitchValue = bindings?.[SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH_ENV_KEY];
  if (isTruthySwitchValue(bindingSwitchValue)) {
    return true;
  }

  return isTruthySwitchValue(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
      SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH_ENV_KEY
    ],
  );
}

function resolveTokenExpiresAt(expiresInSeconds: number | null | undefined): string | null {
  if (typeof expiresInSeconds !== "number" || !Number.isFinite(expiresInSeconds) || expiresInSeconds <= 0) {
    return null;
  }
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function createLinkedInOAuthSocialOwnershipPrepContractForSocialDb(socialDb: D1Database) {
  return createSocialFlowLinkedInOAuthSocialOwnershipPrepContract({
    queryOne: async <T>(sql: string, ...params: unknown[]) => {
      const result = await socialDb.prepare(sql).bind(...params).all<T>();
      const rows = Array.isArray(result.results) ? (result.results as T[]) : [];
      return rows[0] ?? null;
    },
    run: async (sql: string, ...params: unknown[]) => {
      const result = await socialDb.prepare(sql).bind(...params).run();
      return Boolean(result.success);
    },
  });
}

async function maybePrepareSocialOwnedLinkedInOAuthConnection(input: {
  socialDb: D1Database;
  accountId: string;
  tenantId: string;
  saasId: string;
  token: LinkedInTokenResponse;
  identity: LinkedInResolvedIdentity;
  profile: LinkedInUserProfile;
  encryptedAccessToken: string | null;
  encryptedIdToken: string | null;
  status: string;
  validation: CoreProjectionResult["validation"];
}) {
  // TODO(SocialFlow DB separation): switch LinkedIn OAuth reads/writes to SOCIAL_DB once backfill + parity checks pass.
  if (!isLinkedInOAuthSocialOwnershipPrepWriteEnabled()) {
    return;
  }

  try {
    const ownershipPrepContract = createLinkedInOAuthSocialOwnershipPrepContractForSocialDb(input.socialDb);
    await ownershipPrepContract.upsertPreparedLinkedInOAuthConnection({
      id: input.accountId || crypto.randomUUID(),
      tenantId: input.tenantId,
      saasId: input.saasId,
      provider: "LINKEDIN",
      externalProfileId: input.identity.profileId,
      authorUrn: input.identity.authorUrn,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: null,
      encryptedIdToken: input.encryptedIdToken,
      scopes: input.token.scope ?? null,
      expiresAt: resolveTokenExpiresAt(input.token.expires_in),
      tokenType: input.token.token_type ?? null,
      status: input.status,
      metadataJson: JSON.stringify({
        mode: "live",
        profileId: input.identity.profileId,
        authorUrn: input.identity.authorUrn,
        email: input.identity.email,
        emailVerified: input.identity.emailVerified,
        linkedInSub: input.profile.sub,
        picture: input.identity.picture,
        locale: input.identity.locale,
      }),
      lastValidatedAt: input.validation.checkedAt ?? new Date().toISOString(),
      lastErrorCode: input.validation.error?.code ?? null,
      lastErrorMessage: input.validation.error?.message ?? null,
    });
  } catch (error) {
    console.error("LINKEDIN_OAUTH_SOCIAL_OWNERSHIP_PREP_ERROR", error);
  }
}

async function recordConnectionActivity(input: {
  tenantId: string;
  saasId: string;
  status: "success" | "error";
  summary: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await emitLinkedInOAuthActivity({
      tenantId: input.tenantId,
      saasId: input.saasId,
      status: input.status,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("LINKEDIN_OAUTH_ACTIVITY_ERROR", error);
  }
}

async function projectLinkedInConnectionToCore(input: PersistLinkedInConnectionInput): Promise<CoreProjectionResult> {
  // TODO(SocialFlow DB separation): remove core-backed OAuth projection once Campamento Base event contract is active.
  try {
    const saveResult = await saveLinkedInConnection({
      tenantId: input.tenantId,
      saasId: input.saasId,
      connectionLabel: input.identity.displayName,
      metadata: {
        provider: "LINKEDIN",
        mode: "live",
        profileId: input.identity.profileId,
        authorUrn: input.identity.authorUrn,
        displayName: input.identity.displayName,
        email: input.identity.email,
        picture: input.identity.picture,
        locale: input.identity.locale,
      },
      credentials: {
        accessToken: input.token.access_token,
        idToken: input.token.id_token ?? null,
        expiresIn: input.token.expires_in,
        scope: input.token.scope ?? null,
        tokenType: input.token.token_type ?? null,
        profileId: input.identity.profileId,
        authorUrn: input.identity.authorUrn,
      },
    });

    const validation = await validateLinkedInConnection({
      tenantId: input.tenantId,
      saasId: input.saasId,
    });

    return {
      existedBefore: saveResult.existedBefore,
      validation,
    };
  } catch (error) {
    console.error("LINKEDIN_OAUTH_CORE_PROJECTION_ERROR", error);
    return {
      existedBefore: false,
      validation: {
        ok: false,
        status: "CORE_PROJECTION_UNAVAILABLE",
        checkedAt: new Date().toISOString(),
        error: {
          code: "CORE_PROJECTION_UNAVAILABLE",
          message: error instanceof Error ? error.message : "Core-backed OAuth projection unavailable.",
        },
      },
    };
  }
}

function normalizeSocialOwnedLinkedInStatus(status: string | null | undefined): string {
  const normalized = normalizeSwitchValue(status).toUpperCase();
  if (!normalized) {
    return "PENDING_REAL";
  }
  return normalized;
}

async function resolveLinkedInConnectionProjectionFromSocialDb(input: {
  socialDb: D1Database;
  tenantId: string;
  saasId: string;
}): Promise<CoreProjectionResult | null> {
  try {
    const ownershipPrepContract = createLinkedInOAuthSocialOwnershipPrepContractForSocialDb(input.socialDb);
    const prepared = await ownershipPrepContract.getPreparedLinkedInOAuthConnection(
      input.tenantId,
      input.saasId,
      "LINKEDIN",
    );

    if (!prepared || !normalizeSwitchValue(prepared.encrypted_access_token)) {
      return null;
    }

    const status = normalizeSocialOwnedLinkedInStatus(prepared.status);
    const checkedAt = prepared.last_validated_at ?? prepared.updated_at ?? new Date().toISOString();
    const errorCode = prepared.last_error_code ?? null;
    const errorMessage = prepared.last_error_message ?? null;

    return {
      existedBefore: true,
      validation: {
        ok: status === "CONNECTED_REAL",
        status,
        checkedAt,
        error: errorCode || errorMessage
          ? {
              code: errorCode ?? undefined,
              message: errorMessage ?? undefined,
            }
          : null,
      },
    };
  } catch (error) {
    console.warn("LINKEDIN_OAUTH_SOCIAL_DB_READ_FAILED", {
      tenantId: input.tenantId,
      saasId: input.saasId,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveLinkedInConnectionProjection(
  input: PersistLinkedInConnectionInput & { socialDb: D1Database },
): Promise<CoreProjectionResult> {
  // TODO(SocialFlow DB separation): switch OAuth reads/writes to SOCIAL_DB once backfill + parity checks pass.
  if (isLinkedInOAuthSocialDbReadEnabled()) {
    const socialProjection = await resolveLinkedInConnectionProjectionFromSocialDb({
      socialDb: input.socialDb,
      tenantId: input.tenantId,
      saasId: input.saasId,
    });
    if (socialProjection) {
      return socialProjection;
    }
  }

  return projectLinkedInConnectionToCore(input);
}

export async function persistSocialFlowLinkedInConnection(
  input: PersistLinkedInConnectionInput,
): Promise<PersistLinkedInConnectionResult> {
  const socialContext = await resolveSocialContext({
    tenantId: input.tenantId,
    saasId: input.saasId,
  });
  const coreProjection = await resolveLinkedInConnectionProjection({
    ...input,
    socialDb: socialContext.socialDb,
  });
  const existingAccount = (await listSaasSocialAccounts(socialContext)).find((account) => account.provider === "LINKEDIN");
  const persistenceStatus = coreProjection.existedBefore || existingAccount ? "updated" : "persisted";

  const encryptedAccessToken = await encryptToken(input.token.access_token);
  const encryptedIdToken = await encryptToken(input.token.id_token ?? null);
  // refresh_token solo viene si la app está aprobada como partner MDP (Marketing
  // Developer Platform) — ver refreshLinkedInAccessToken en core.ts. Ausente hoy
  // en el caso normal; se guarda si algún día aparece.
  const encryptedRefreshToken = await encryptToken(input.token.refresh_token ?? null);
  const socialAccountStatus = coreProjection.validation.ok ? "CONNECTED_REAL" : "PENDING_REAL";

  const account = await upsertSaasSocialAccount(socialContext, {
    id: existingAccount?.id,
    saasId: input.saasId,
    provider: "LINKEDIN",
    handle: input.identity.email,
    displayName: input.identity.displayName,
    status: socialAccountStatus,
    authMeta: {
      mode: "live",
      provider: "LINKEDIN",
      accessToken: encryptedAccessToken,
      idToken: encryptedIdToken,
      expiresIn: input.token.expires_in,
      // expiresAt (absoluto) — necesario para linkedin/token-health.ts, que no
      // puede calcular vencimiento solo con expiresIn relativo + updated_at
      // (updated_at se toca en cada upsert, no solo en la conexión inicial).
      expiresAt: resolveTokenExpiresAt(input.token.expires_in),
      refreshToken: encryptedRefreshToken,
      refreshTokenExpiresAt: resolveTokenExpiresAt(input.token.refresh_token_expires_in),
      scope: input.token.scope ?? null,
      tokenType: input.token.token_type ?? null,
      profileId: input.identity.profileId,
      authorUrn: input.identity.authorUrn,
      email: input.identity.email,
      emailVerified: input.identity.emailVerified,
      picture: input.identity.picture,
      locale: input.identity.locale,
      linkedInSub: input.profile.sub,
      organizationUrn: input.organization?.organizationUrn ?? null,
      organizationId: input.organization?.organizationId ?? null,
      organizationName: input.organization?.name ?? null,
      lastValidationAt: coreProjection.validation.checkedAt ?? new Date().toISOString(),
      lastErrorCode: coreProjection.validation.error?.code ?? null,
      lastErrorMessage: coreProjection.validation.error?.message ?? null,
    },
    isPrimary: true,
  });

  await maybePrepareSocialOwnedLinkedInOAuthConnection({
    socialDb: socialContext.socialDb,
    accountId: account.id,
    tenantId: input.tenantId,
    saasId: input.saasId,
    token: input.token,
    identity: input.identity,
    profile: input.profile,
    encryptedAccessToken,
    encryptedIdToken,
    status: socialAccountStatus,
    validation: coreProjection.validation,
  });

  await recordConnectionActivity({
    tenantId: input.tenantId,
    saasId: input.saasId,
    status: coreProjection.validation.ok ? "success" : "error",
    summary: coreProjection.validation.ok
      ? "LinkedIn OAuth connection completed."
      : coreProjection.validation.error?.message ?? "LinkedIn OAuth connection needs attention.",
    metadata: {
      profileId: input.identity.profileId,
      email: input.identity.email,
      validationStatus: coreProjection.validation.status,
      errorCode: coreProjection.validation.error?.code ?? null,
    },
  });

  return { account, status: persistenceStatus };
}
