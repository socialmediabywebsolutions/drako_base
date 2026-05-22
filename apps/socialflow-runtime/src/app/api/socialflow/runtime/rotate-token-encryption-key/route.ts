export const dynamic = "force-dynamic";

import { getSocialFlowRuntimeEnv } from "../../../../../lib/runtime-env";
import { ensureSocialDb, queryOne, run } from "../../../../../lib/db/runtime-db";
import {
  TokenEncryptionError,
  decryptToken,
  encryptTokenWithNext,
  isEncryptedToken,
  isNextEncryptionAvailable,
} from "../../../../../lib/socialflow/token-encryption";
import { logRuntimeEvent, runtimeJson } from "../../../../../lib/runtime-observability";

const CANARY_GATE_HEADER = "x-socialflow-canary-gate";
const CANARY_HOST = "socialflow-canary.drako.systems";
const CANARY_RUNTIME_TARGET = "canary";
const CANARY_TENANT_ID = "tenant_socialflow_canary_staff";
const CANARY_SAAS_ID = "p2-24i-saas";
const LINKEDIN_PROVIDER = "LINKEDIN";

type RotateBody = {
  confirmRotate?: boolean;
};

type AuthMeta = {
  accessToken?: string;
  idToken?: string;
  lastKeyRotationAt?: string;
  [key: string]: unknown;
};

type SocialAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  status: string;
  auth_meta: string | null;
  updated_at: string;
};

function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.trim().toLowerCase().replace(/:\d+$/, "");
}

function checkCanaryGate(request: Request): { allowed: boolean } {
  const gateToken = getSocialFlowRuntimeEnv()?.SOCIALFLOW_CANARY_GATE_TOKEN?.trim() ?? "";
  if (!gateToken) {
    return { allowed: false };
  }

  const provided = request.headers.get(CANARY_GATE_HEADER)?.trim() ?? "";
  const allowed = provided.length > 0 && provided === gateToken;
  return { allowed };
}

function checkExecutionContext(request: Request): { allowed: boolean; reason?: string } {
  const runtimeTarget = getSocialFlowRuntimeEnv()?.SOCIALFLOW_RUNTIME_TARGET?.trim().toLowerCase() ?? "";
  if (runtimeTarget !== CANARY_RUNTIME_TARGET) {
    return { allowed: false, reason: "runtime_target_not_canary" };
  }

  const forwardedHost = normalizeHost(request.headers.get("x-forwarded-host"));
  const host = normalizeHost(request.headers.get("host"));
  const resolvedHost = forwardedHost || host;
  if (resolvedHost !== CANARY_HOST) {
    return { allowed: false, reason: "host_not_canary" };
  }

  return { allowed: true };
}

async function rotateTokenValue(value: unknown): Promise<{
  changed: boolean;
  value: string | null | undefined;
  status: "missing" | "rotated_from_plaintext" | "rotated_from_current" | "already_rotated_with_next";
}> {
  if (typeof value !== "string" || !value.trim()) {
    return { changed: false, value: typeof value === "string" ? value : null, status: "missing" };
  }

  if (!isEncryptedToken(value)) {
    const rotatedPlain = await encryptTokenWithNext(value);
    return { changed: true, value: rotatedPlain, status: "rotated_from_plaintext" };
  }

  try {
    const plaintext = await decryptToken(value, { allowNextFallback: false });
    if (!plaintext) {
      throw new TokenEncryptionError("Encrypted token decrypted to empty value.", "DECRYPTION_FAILED");
    }
    const rotated = await encryptTokenWithNext(plaintext);
    return { changed: rotated !== value, value: rotated, status: "rotated_from_current" };
  } catch (error) {
    if (!(error instanceof TokenEncryptionError) || error.code !== "DECRYPTION_FAILED") {
      throw error;
    }

    const candidate = await decryptToken(value, { allowNextFallback: true });
    if (!candidate) {
      throw error;
    }
    return { changed: false, value, status: "already_rotated_with_next" };
  }
}

export async function POST(request: Request) {
  try {
    const contextCheck = checkExecutionContext(request);
    if (!contextCheck.allowed) {
      logRuntimeEvent("warn", "token_key_rotation_context_denied", {
        correlationId: request.headers.get("x-correlation-id") ?? undefined,
        reason: contextCheck.reason ?? "context_denied",
      });
      return runtimeJson({ error: "Not Found", code: "NOT_FOUND" }, { status: 404 }, { request });
    }

    const gateCheck = checkCanaryGate(request);
    if (!gateCheck.allowed) {
      return runtimeJson({ error: "Forbidden", code: "GATE_REQUIRED" }, { status: 403 }, { request });
    }

    if (!isNextEncryptionAvailable()) {
      return runtimeJson(
        {
          success: false,
          error: "NEXT_SECRET_REQUIRED",
          code: "ENCRYPTION_NEXT_SECRET_MISSING",
        },
        { status: 409 },
        { request },
      );
    }

    const body = (await request.json().catch(() => ({}))) as RotateBody;
    if (body.confirmRotate !== true) {
      return runtimeJson(
        { success: false, error: "CONFIRM_ROTATE_REQUIRED", code: "INVALID_INPUT" },
        { status: 400 },
        { request },
      );
    }

    const db = ensureSocialDb();
    const row = await queryOne<SocialAccountRow>(
      db,
      `SELECT id, tenant_id, saas_id, provider, status, auth_meta, updated_at
       FROM saas_social_accounts
       WHERE tenant_id = ? AND saas_id = ? AND provider = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      CANARY_TENANT_ID,
      CANARY_SAAS_ID,
      LINKEDIN_PROVIDER,
    );

    if (!row) {
      return runtimeJson(
        { success: false, error: "LINKEDIN_ACCOUNT_NOT_FOUND", code: "NOT_FOUND" },
        { status: 404 },
        { request },
      );
    }

    const authMeta: AuthMeta = row.auth_meta ? JSON.parse(row.auth_meta) : {};
    const accessRotation = await rotateTokenValue(authMeta.accessToken);
    const idRotation = await rotateTokenValue(authMeta.idToken);
    const changed = accessRotation.changed || idRotation.changed;

    if (!changed) {
      return runtimeJson(
        {
          success: true,
          updated: false,
          tenantId: row.tenant_id,
          saasId: row.saas_id,
          provider: row.provider,
          status: row.status,
          tokenRotation: {
            access: accessRotation.status,
            id: idRotation.status,
          },
        },
        { status: 200 },
        { request },
      );
    }

    const now = new Date().toISOString();
    const nextAuthMeta: AuthMeta = {
      ...authMeta,
      accessToken: accessRotation.value ?? undefined,
      idToken: idRotation.value ?? undefined,
      lastKeyRotationAt: now,
    };

    await run(
      db,
      `UPDATE saas_social_accounts
       SET auth_meta = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND saas_id = ? AND provider = ?`,
      JSON.stringify(nextAuthMeta),
      now,
      row.id,
      row.tenant_id,
      row.saas_id,
      row.provider,
    );

    return runtimeJson(
      {
        success: true,
        updated: true,
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        provider: row.provider,
        status: row.status,
        rotatedAt: now,
        tokenRotation: {
          access: accessRotation.status,
          id: idRotation.status,
        },
      },
      { status: 200 },
      { request },
    );
  } catch (error) {
    const code =
      error instanceof TokenEncryptionError
        ? error.code
        : "TOKEN_KEY_ROTATION_FAILED";

    logRuntimeEvent("error", "token_key_rotation_error", {
      correlationId: request.headers.get("x-correlation-id") ?? undefined,
      code,
    });

    return runtimeJson(
      { success: false, error: "TOKEN_KEY_ROTATION_FAILED", code },
      { status: 500 },
      { request },
    );
  }
}

export const __tokenKeyRotationInternals = {
  normalizeHost,
  checkCanaryGate,
  checkExecutionContext,
  rotateTokenValue,
};
