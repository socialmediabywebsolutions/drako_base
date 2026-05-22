export const dynamic = "force-dynamic";

import { requireCurrentSocialFlowSession } from "../../../../../lib/auth/session";
import { respondDatabaseError, run } from "../../../../../lib/db/runtime-db";
import { getSocialFlowRuntimeEnv } from "../../../../../lib/runtime-env";
import { getRuntimeCorrelationId, logRuntimeEvent, runtimeJson } from "../../../../../lib/runtime-observability";
import { type RuntimeSocialContext, nowIso, resolveRuntimeSocialContext, serializeJsonRecord } from "../../../../../lib/socialflow/runtime-repository-core";
import { findPrimaryRuntimeLinkedInAccount } from "../../../../../lib/socialflow/posts-repository";
import { type RuntimeSocialAccount } from "../../../../../lib/socialflow/contracts";
import { isEncryptedToken } from "../../../../../lib/socialflow/token-encryption";
import { LinkedInIntegrationError } from "../../../../../lib/socialflow/linkedin/core";
import { validateRuntimeLinkedInAccount } from "../../../../../lib/socialflow/linkedin/publishing";

const CANARY_HOST = "socialflow-canary.drako.systems";
const CANARY_RUNTIME_TARGET = "canary";
const CANARY_TENANT_ID = "tenant_socialflow_canary_staff";
const CANARY_SAAS_ID = "p2-24i-saas";

type ValidateBody = {
  saasId?: string | null;
};

type LinkedInAuthMeta = {
  accessToken?: string;
  profileId?: string;
  linkedInSub?: string;
  lastValidationAt?: string;
  lastErrorCode?: string | null;
  lastErrorMessage?: string | null;
  [key: string]: unknown;
};

function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

function checkValidateExecutionContext(request: Request): { allowed: boolean; reason?: string } {
  const env = getSocialFlowRuntimeEnv();
  const runtimeTarget = env?.SOCIALFLOW_RUNTIME_TARGET?.trim().toLowerCase() ?? "";
  const isCanaryRuntime = runtimeTarget === CANARY_RUNTIME_TARGET;

  const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host"));
  const host = normalizeHost(request.headers.get("host"));
  const resolvedHost = forwardedHost || host;
  const isCanaryHost = resolvedHost === CANARY_HOST;

  if (!isCanaryRuntime && !isCanaryHost) {
    return { allowed: false, reason: "non_canary_context" };
  }

  return { allowed: true };
}

function resolveStoredProfileId(authMeta: LinkedInAuthMeta): string | null {
  if (typeof authMeta.profileId === "string" && authMeta.profileId.trim()) {
    return authMeta.profileId.trim();
  }
  if (typeof authMeta.linkedInSub === "string" && authMeta.linkedInSub.trim()) {
    return authMeta.linkedInSub.trim();
  }
  return null;
}

function buildValidationMetadata(
  authMeta: LinkedInAuthMeta,
  patch: {
    lastValidationAt?: string;
    lastErrorCode?: string | null;
    lastErrorMessage?: string | null;
  },
): LinkedInAuthMeta {
  return {
    ...authMeta,
    ...(typeof patch.lastValidationAt === "string" ? { lastValidationAt: patch.lastValidationAt } : {}),
    ...(patch.lastErrorCode === undefined ? {} : { lastErrorCode: patch.lastErrorCode }),
    ...(patch.lastErrorMessage === undefined ? {} : { lastErrorMessage: patch.lastErrorMessage }),
  };
}

async function persistValidationState(params: {
  context: RuntimeSocialContext;
  account: RuntimeSocialAccount;
  authMeta: LinkedInAuthMeta;
  status: string;
  validatedAt?: string;
  errorCode?: string | null;
}) {
  const nextAuthMeta = buildValidationMetadata(params.authMeta, {
    lastValidationAt: params.validatedAt,
    lastErrorCode: params.errorCode ?? null,
    lastErrorMessage: params.errorCode ? "LINKEDIN_VALIDATION_FAILED" : null,
  });

  await run(
    params.context.socialDb,
    `UPDATE saas_social_accounts
     SET status = ?, auth_meta = ?, updated_at = ?
     WHERE id = ? AND tenant_id = ? AND saas_id = ? AND provider = 'LINKEDIN'`,
    params.status,
    serializeJsonRecord(nextAuthMeta),
    nowIso(),
    params.account.id,
    params.context.tenantId,
    params.context.saasId,
  );
}

export async function POST(request: Request) {
  const correlationId = getRuntimeCorrelationId(request);
  let context: RuntimeSocialContext | null = null;
  let account: RuntimeSocialAccount | null = null;
  let authMeta: LinkedInAuthMeta = {};

  try {
    const contextCheck = checkValidateExecutionContext(request);
    if (!contextCheck.allowed) {
      logRuntimeEvent("warn", "linkedin_validate_connection_context_denied", {
        correlationId,
        reason: contextCheck.reason ?? "context_denied",
      });
      return runtimeJson({ ok: false, error: "NOT_FOUND" }, { status: 404 }, { request, correlationId });
    }

    const session = await requireCurrentSocialFlowSession(request);
    if (session.tenantId !== CANARY_TENANT_ID) {
      return runtimeJson(
        { ok: false, error: "FORBIDDEN_TENANT_SCOPE" },
        { status: 403 },
        { request, correlationId },
      );
    }

    const body = (await request.json().catch(() => null)) as ValidateBody | null;
    const saasId = body?.saasId?.trim() ?? "";
    if (!saasId) {
      return runtimeJson(
        { ok: false, error: "INVALID_INPUT", message: "saasId is required." },
        { status: 400 },
        { request, correlationId },
      );
    }
    if (saasId !== CANARY_SAAS_ID) {
      return runtimeJson(
        { ok: false, error: "FORBIDDEN_SAAS_SCOPE" },
        { status: 403 },
        { request, correlationId },
      );
    }

    context = await resolveRuntimeSocialContext({ tenantId: session.tenantId, saasId });
    account = await findPrimaryRuntimeLinkedInAccount({ tenantId: context.tenantId, saasId: context.saasId });
    if (!account) {
      return runtimeJson(
        { ok: false, error: "LINKEDIN_ACCOUNT_NOT_FOUND" },
        { status: 404 },
        { request, correlationId },
      );
    }

    if (account.status !== "CONNECTED_REAL") {
      return runtimeJson(
        {
          ok: false,
          error: "LINKEDIN_ACCOUNT_NOT_CONNECTED_REAL",
          status: account.status,
        },
        { status: 409 },
        { request, correlationId },
      );
    }

    authMeta = (account.authMeta ?? {}) as LinkedInAuthMeta;
    const encryptedTokenValue = typeof authMeta.accessToken === "string" ? authMeta.accessToken : null;
    const tokenEncrypted = isEncryptedToken(encryptedTokenValue);

    try {
      const validation = await validateRuntimeLinkedInAccount(account);
      const validatedAt = nowIso();
      const storedProfileId = resolveStoredProfileId(authMeta);
      const profileMatch = storedProfileId ? storedProfileId === validation.profileId : true;

      await persistValidationState({
        context,
        account,
        authMeta,
        status: "CONNECTED_REAL",
        validatedAt,
        errorCode: null,
      });

      return runtimeJson(
        {
          ok: true,
          provider: "LINKEDIN",
          status: "CONNECTED_REAL",
          tokenEncrypted,
          validatedAt,
          profileMatch,
        },
        { status: 200 },
        { request, correlationId },
      );
    } catch (error) {
      if (error instanceof LinkedInIntegrationError && context && account) {
        const nextStatus = error.accountStatus === "INVALID_CREDENTIALS" ? "INVALID_CREDENTIALS" : account.status;
        await persistValidationState({
          context,
          account,
          authMeta,
          status: nextStatus,
          errorCode: error.code,
        });

        logRuntimeEvent("warn", "linkedin_validate_connection_failed", {
          correlationId,
          code: error.code,
          status: nextStatus,
          tenantId: context.tenantId,
          saasId: context.saasId,
        });

        return runtimeJson(
          {
            ok: false,
            error: "LINKEDIN_VALIDATION_FAILED",
            code: error.code,
            provider: "LINKEDIN",
            status: nextStatus,
            tokenEncrypted,
          },
          { status: 502 },
          { request, correlationId },
        );
      }
      throw error;
    }
  } catch (error) {
    const dbError = respondDatabaseError(error, request);
    if (dbError) return dbError;
    if (error instanceof Error && error.message === "SESSION_REQUIRED") {
      return runtimeJson({ ok: false, error: "SESSION_REQUIRED" }, { status: 401 }, { request, correlationId });
    }

    logRuntimeEvent("error", "linkedin_validate_connection_unexpected_error", {
      correlationId,
      message: error instanceof Error ? error.message : String(error),
    });
    return runtimeJson(
      {
        ok: false,
        error: "LINKEDIN_VALIDATE_CONNECTION_FAILED",
      },
      { status: 500 },
      { request, correlationId },
    );
  }
}

export const __validateConnectionInternals = {
  normalizeHost,
  checkValidateExecutionContext,
  resolveStoredProfileId,
};
