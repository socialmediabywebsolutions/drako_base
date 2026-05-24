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
