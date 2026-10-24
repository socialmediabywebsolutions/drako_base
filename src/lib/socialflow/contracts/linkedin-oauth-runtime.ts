import { connectIntegration, getIntegrationConnection, validateIntegrationConnection } from "@/lib/integration-core";
import {
  LINKEDIN_INTEGRATION_KEY,
  ensureLinkedInIntegrationAvailable,
} from "@/lib/integration-core/providers/linkedin";
import { recordObservabilityActivity } from "@/lib/observability-core";

export type SaveLinkedInConnectionInput = {
  tenantId: string;
  saasId: string;
  connectionLabel: string;
  metadata: Record<string, unknown>;
  credentials: Record<string, unknown>;
};

export type SaveLinkedInConnectionResult = {
  existedBefore: boolean;
};

export type ValidateLinkedInConnectionInput = {
  tenantId: string;
  saasId: string;
};

export type ValidateLinkedInConnectionResult = {
  ok: boolean;
  status: string;
  checkedAt?: string;
  error?: {
    code?: string;
    message?: string;
  } | null;
};

export type EmitLinkedInOAuthActivityInput = {
  tenantId: string;
  saasId: string;
  status: "success" | "error";
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export type SocialFlowLinkedInOAuthOwnershipRecord = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  external_profile_id: string;
  author_urn: string | null;
  encrypted_access_token: string;
  encrypted_refresh_token: string | null;
  encrypted_id_token: string | null;
  scopes: string | null;
  expires_at: string | null;
  token_type: string | null;
  status: string;
  metadata_json: string;
  last_validated_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type UpsertSocialFlowLinkedInOAuthOwnershipInput = {
  id: string;
  tenantId: string;
  saasId: string;
  provider: string;
  externalProfileId: string;
  authorUrn: string | null;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;
  encryptedIdToken: string | null;
  scopes: string | null;
  expiresAt: string | null;
  tokenType: string | null;
  status: string;
  metadataJson: string;
  lastValidatedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

type SocialFlowLinkedInOAuthOwnershipPrepExecutor = {
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  run: (sql: string, ...params: unknown[]) => Promise<boolean>;
};

export function createSocialFlowLinkedInOAuthSocialOwnershipPrepContract(
  executor: SocialFlowLinkedInOAuthOwnershipPrepExecutor,
) {
  // TODO(SocialFlow DB separation): switch LinkedIn OAuth reads/writes to SOCIAL_DB once backfill + parity checks pass.
  return {
    async getPreparedLinkedInOAuthConnection(
      tenantId: string,
      saasId: string,
      provider = "LINKEDIN",
    ): Promise<SocialFlowLinkedInOAuthOwnershipRecord | null> {
      return executor.queryOne<SocialFlowLinkedInOAuthOwnershipRecord>(
        `SELECT
           id,
           tenant_id,
           saas_id,
           provider,
           external_profile_id,
           author_urn,
           encrypted_access_token,
           encrypted_refresh_token,
           encrypted_id_token,
           scopes,
           expires_at,
           token_type,
           status,
           metadata_json,
           last_validated_at,
           last_error_code,
           last_error_message,
           created_at,
           updated_at
         FROM socialflow_oauth_connections
         WHERE tenant_id = ? AND saas_id = ? AND provider = ?
         ORDER BY datetime(updated_at) DESC, rowid DESC
         LIMIT 1`,
        tenantId,
        saasId,
        provider,
      );
    },

    async upsertPreparedLinkedInOAuthConnection(input: UpsertSocialFlowLinkedInOAuthOwnershipInput): Promise<void> {
      const success = await executor.run(
        `INSERT INTO socialflow_oauth_connections (
          id,
          tenant_id,
          saas_id,
          provider,
          external_profile_id,
          author_urn,
          encrypted_access_token,
          encrypted_refresh_token,
          encrypted_id_token,
          scopes,
          expires_at,
          token_type,
          status,
          metadata_json,
          last_validated_at,
          last_error_code,
          last_error_message,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        ON CONFLICT(tenant_id, saas_id, provider) DO UPDATE SET
          external_profile_id = excluded.external_profile_id,
          author_urn = excluded.author_urn,
          encrypted_access_token = excluded.encrypted_access_token,
          encrypted_refresh_token = excluded.encrypted_refresh_token,
          encrypted_id_token = excluded.encrypted_id_token,
          scopes = excluded.scopes,
          expires_at = excluded.expires_at,
          token_type = excluded.token_type,
          status = excluded.status,
          metadata_json = excluded.metadata_json,
          last_validated_at = excluded.last_validated_at,
          last_error_code = excluded.last_error_code,
          last_error_message = excluded.last_error_message,
          updated_at = excluded.updated_at`,
        input.id,
        input.tenantId,
        input.saasId,
        input.provider,
        input.externalProfileId,
        input.authorUrn,
        input.encryptedAccessToken,
        input.encryptedRefreshToken,
        input.encryptedIdToken,
        input.scopes,
        input.expiresAt,
        input.tokenType,
        input.status,
        input.metadataJson,
        input.lastValidatedAt,
        input.lastErrorCode,
        input.lastErrorMessage,
      );

      if (!success) {
        throw new Error("SOCIALFLOW_LINKEDIN_OAUTH_OWNERSHIP_PREP_UPSERT_FAILED");
      }
    },
  };
}

async function ensureLinkedInCoreAdapterAvailable() {
  // TODO(SocialFlow DB separation): replace core-backed OAuth/integration adapter with SOCIAL_DB-owned storage and Campamento Base contract.
  // TODO(SocialFlow DB separation): remove core-backed OAuth projection once Campamento Base event contract is active.
  await ensureLinkedInIntegrationAvailable();
}

export async function saveLinkedInConnection(
  input: SaveLinkedInConnectionInput,
): Promise<SaveLinkedInConnectionResult> {
  await ensureLinkedInCoreAdapterAvailable();
  const existing = await getIntegrationConnection(
    input.tenantId,
    input.saasId,
    LINKEDIN_INTEGRATION_KEY,
  );

  await connectIntegration({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: LINKEDIN_INTEGRATION_KEY,
    connectionLabel: input.connectionLabel,
    status: "PENDING",
    metadata: input.metadata,
    credentials: input.credentials,
  });

  return {
    existedBefore: Boolean(existing),
  };
}

export async function validateLinkedInConnection(
  input: ValidateLinkedInConnectionInput,
): Promise<ValidateLinkedInConnectionResult> {
  await ensureLinkedInCoreAdapterAvailable();
  const validation = await validateIntegrationConnection({
    tenantId: input.tenantId,
    saasId: input.saasId,
    integrationKey: LINKEDIN_INTEGRATION_KEY,
  });

  return {
    ok: validation.ok,
    status: validation.status,
    checkedAt: validation.checkedAt ?? undefined,
    error: validation.error
      ? {
          code: validation.error.code,
          message: validation.error.message,
        }
      : null,
  };
}

export async function emitLinkedInOAuthActivity(input: EmitLinkedInOAuthActivityInput) {
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
}
