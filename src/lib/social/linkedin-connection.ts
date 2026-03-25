import { connectIntegration, getIntegrationConnection, validateIntegrationConnection } from "@/lib/integration-core";
import {
  LINKEDIN_INTEGRATION_KEY,
  ensureLinkedInIntegrationAvailable,
} from "@/lib/integration-core/providers/linkedin";
import { recordObservabilityActivity } from "@/lib/observability-core";
import { listSaasSocialAccounts, resolveSocialContext, upsertSaasSocialAccount } from "@/lib/social/repository";
import type { SaasSocialAccount } from "@/lib/social/types";
import type { LinkedInResolvedIdentity, LinkedInTokenResponse, LinkedInUserProfile } from "@/lib/social/linkedin";

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
    await recordObservabilityActivity({
      tenantId: input.tenantId,
      saasId: input.saasId,
      sourceType: "integration",
      sourceKey: LINKEDIN_INTEGRATION_KEY,
      activityType: "linkedin_oauth_callback",
      status: input.status,
      summary: input.summary,
      metadata: input.metadata ?? null,
    });
  } catch (error) {
    console.error("LINKEDIN_OAUTH_ACTIVITY_ERROR", error);
  }
}

export async function persistLinkedInConnection(
  input: PersistLinkedInConnectionInput,
): Promise<PersistLinkedInConnectionResult> {
  await ensureLinkedInIntegrationAvailable();
  const existingIntegration = await getIntegrationConnection(
    input.tenantId,
    input.saasId,
    LINKEDIN_INTEGRATION_KEY,
  );
  const socialContext = await resolveSocialContext({
    tenantId: input.tenantId,
    saasId: input.saasId,
  });
  const existingAccount = (await listSaasSocialAccounts(socialContext)).find((account) => account.provider === "LINKEDIN");
  const persistenceStatus = existingIntegration || existingAccount ? "updated" : "persisted";

  await connectIntegration({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: LINKEDIN_INTEGRATION_KEY,
    connectionLabel: input.identity.displayName,
    status: "PENDING",
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

  const validation = await validateIntegrationConnection({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: LINKEDIN_INTEGRATION_KEY,
  });

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
      accessToken: input.token.access_token,
      idToken: input.token.id_token ?? null,
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
