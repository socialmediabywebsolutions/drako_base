import { queryOne, run } from "../../db/runtime-db";
import type { RuntimeSocialAccount } from "../contracts";
import {
  ensureRuntimeChannelForProvider,
  generateRuntimeId,
  mapSocialAccountRow,
  nowIso,
  resolveRuntimeSocialContext,
  serializeJsonRecord,
} from "../runtime-repository-core";
import { encryptToken } from "../token-encryption";
import {
  type LinkedInResolvedIdentity,
  type LinkedInTokenResponse,
  type LinkedInUserProfile,
  verifyLinkedInAccess,
} from "./core";

type SocialAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string | null;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  is_primary?: number;
  primary?: number;
  created_at: string;
  updated_at: string;
};

type PersistLinkedInConnectionInput = {
  tenantId: string;
  saasId: string;
  token: LinkedInTokenResponse;
  profile: LinkedInUserProfile;
  identity: LinkedInResolvedIdentity;
};

export type PersistLinkedInConnectionResult = {
  account: RuntimeSocialAccount;
  status: "persisted" | "updated";
};

async function findRuntimeLinkedInAccountRow(input: { tenantId: string; saasId: string }) {
  const context = await resolveRuntimeSocialContext(input);
  const row = await queryOne<SocialAccountRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, is_primary, created_at, updated_at
     FROM saas_social_accounts
     WHERE tenant_id = ? AND saas_id = ? AND provider = 'LINKEDIN'
     ORDER BY is_primary DESC, datetime(updated_at) DESC
     LIMIT 1`,
    context.tenantId,
    context.saasId,
  );
  return { context, row };
}

export async function persistRuntimeLinkedInConnection(
  input: PersistLinkedInConnectionInput,
): Promise<PersistLinkedInConnectionResult> {
  const { context, row: existing } = await findRuntimeLinkedInAccountRow(input);
  await ensureRuntimeChannelForProvider(context, "LINKEDIN");

  const validation = await verifyLinkedInAccess(input.token.access_token);
  const now = nowIso();
  const status = existing ? "updated" : "persisted";
  const accountId = existing?.id ?? generateRuntimeId("sf_linkedin_account");

  await run(
    context.socialDb,
    `UPDATE saas_social_accounts
     SET is_primary = 0, updated_at = ?
     WHERE tenant_id = ? AND saas_id = ?`,
    now,
    context.tenantId,
    context.saasId,
  );

  // Encrypt sensitive tokens before persisting
  const encryptedAccessToken = await encryptToken(input.token.access_token);
  const encryptedIdToken = await encryptToken(input.token.id_token ?? null);

  await run(
    context.socialDb,
    `INSERT INTO saas_social_accounts (id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, is_primary, created_at, updated_at)
     VALUES (?, ?, ?, 'LINKEDIN', ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       handle = excluded.handle,
       display_name = excluded.display_name,
       status = excluded.status,
       auth_meta = excluded.auth_meta,
       is_primary = excluded.is_primary,
       updated_at = excluded.updated_at
     WHERE saas_social_accounts.tenant_id = excluded.tenant_id
       AND saas_social_accounts.saas_id = excluded.saas_id`,
    accountId,
    context.tenantId,
    context.saasId,
    input.identity.email,
    validation.displayName,
    "CONNECTED_REAL",
    serializeJsonRecord({
      mode: "live",
      provider: "LINKEDIN",
      accessToken: encryptedAccessToken,
      idToken: encryptedIdToken,
      expiresIn: input.token.expires_in,
      scope: input.token.scope ?? null,
      tokenType: input.token.token_type ?? null,
      profileId: input.identity.profileId,
      authorUrn: validation.authorUrn,
      email: input.identity.email,
      emailVerified: input.identity.emailVerified,
      picture: input.identity.picture,
      locale: input.identity.locale,
      linkedInSub: input.profile.sub,
      lastValidationAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    }),
    existing?.created_at ?? now,
    now,
  );

  const stored = await queryOne<SocialAccountRow>(
    context.socialDb,
    `SELECT id, tenant_id, saas_id, provider, handle, display_name, status, auth_meta, is_primary, created_at, updated_at
     FROM saas_social_accounts
     WHERE tenant_id = ? AND saas_id = ? AND id = ?
     LIMIT 1`,
    context.tenantId,
    context.saasId,
    accountId,
  );

  if (!stored) {
    throw new Error("SOCIALFLOW_RUNTIME_LINKEDIN_ACCOUNT_PERSISTENCE_FAILED");
  }

  return {
    account: mapSocialAccountRow(stored),
    status,
  };
}
