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

export async function persistSocialFlowLinkedInConnection(
  input: PersistLinkedInConnectionInput,
): Promise<PersistLinkedInConnectionResult> {
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
  const socialContext = await resolveSocialContext({
    tenantId: input.tenantId,
    saasId: input.saasId,
  });
  const existingAccount = (await listSaasSocialAccounts(socialContext)).find((account) => account.provider === "LINKEDIN");
  const persistenceStatus = saveResult.existedBefore || existingAccount ? "updated" : "persisted";

  const validation = await validateLinkedInConnection({
    tenantId: input.tenantId,
    saasId: input.saasId,
  });

  const encryptedAccessToken = await encryptToken(input.token.access_token);
  const encryptedIdToken = await encryptToken(input.token.id_token ?? null);

  const account = await upsertSaasSocialAccount(socialContext, {
    id: existingAccount?.id,
    saasId: input.saasId,
    provider: "LINKEDIN",
    handle: input.identity.email,
    displayName: input.identity.displayName,
    status: validation.ok ? "CONNECTED_REAL" : "PENDING_REAL",
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
      lastValidationAt: validation.checkedAt ?? new Date().toISOString(),
      lastErrorCode: validation.error?.code ?? null,
      lastErrorMessage: validation.error?.message ?? null,
    },
    isPrimary: true,
  });

  await recordConnectionActivity({
    tenantId: input.tenantId,
    saasId: input.saasId,
    status: validation.ok ? "success" : "error",
    summary: validation.ok
      ? "LinkedIn OAuth connection completed."
      : validation.error?.message ?? "LinkedIn OAuth connection needs attention.",
    metadata: {
      profileId: input.identity.profileId,
      email: input.identity.email,
      validationStatus: validation.status,
      errorCode: validation.error?.code ?? null,
    },
  });

  return { account, status: persistenceStatus };
}
