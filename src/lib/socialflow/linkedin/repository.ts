import {
  emitLinkedInOAuthActivity,
  saveLinkedInConnection,
  validateLinkedInConnection,
} from "@/lib/socialflow/contracts/linkedin-oauth-runtime";
import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialAccount } from "@/lib/socialflow/repository";
import type { SaasSocialAccount } from "@/lib/social-core/types";
import { encryptToken } from "@/lib/socialflow/token-encryption";
import type {
  LinkedInResolvedIdentity,
  LinkedInTokenResponse,
  LinkedInUserProfile,
} from "@/lib/socialflow/linkedin/core";

type PersistLinkedInConnectionInput = {
  tenantId: string;
  saasId: string;
  token: LinkedInTokenResponse;
  profile: LinkedInUserProfile;
  identity: LinkedInResolvedIdentity;
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

export async function persistSocialFlowLinkedInConnection(
  input: PersistLinkedInConnectionInput,
): Promise<PersistLinkedInConnectionResult> {
  const coreProjection = await projectLinkedInConnectionToCore(input);
  const socialContext = await resolveSocialContext({
    tenantId: input.tenantId,
    saasId: input.saasId,
  });
  const existingAccount = (await listSaasSocialAccounts(socialContext)).find((account) => account.provider === "LINKEDIN");
  const persistenceStatus = coreProjection.existedBefore || existingAccount ? "updated" : "persisted";

  const encryptedAccessToken = await encryptToken(input.token.access_token);
  const encryptedIdToken = await encryptToken(input.token.id_token ?? null);

  const account = await upsertSaasSocialAccount(socialContext, {
    id: existingAccount?.id,
    saasId: input.saasId,
    provider: "LINKEDIN",
    handle: input.identity.email,
    displayName: input.identity.displayName,
    status: coreProjection.validation.ok ? "CONNECTED_REAL" : "PENDING_REAL",
    authMeta: {
      mode: "live",
      provider: "LINKEDIN",
      accessToken: encryptedAccessToken,
      idToken: encryptedIdToken,
      expiresIn: input.token.expires_in,
      scope: input.token.scope ?? null,
      tokenType: input.token.token_type ?? null,
      profileId: input.identity.profileId,
      authorUrn: input.identity.authorUrn,
      email: input.identity.email,
      emailVerified: input.identity.emailVerified,
      picture: input.identity.picture,
      locale: input.identity.locale,
      linkedInSub: input.profile.sub,
      lastValidationAt: coreProjection.validation.checkedAt ?? new Date().toISOString(),
      lastErrorCode: coreProjection.validation.error?.code ?? null,
      lastErrorMessage: coreProjection.validation.error?.message ?? null,
    },
    isPrimary: true,
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
