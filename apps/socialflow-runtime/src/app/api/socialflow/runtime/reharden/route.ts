/**
 * P2-28 TEMPORARY Rehardening Endpoint
 * 
 * ⚠️  REMOVE AFTER P2-28 VALIDATION
 * 
 * Encrypts plaintext tokens in the canary LinkedIn social account row.
 * Requires canary gate token for security.
 */

export const dynamic = "force-dynamic";

import { getSocialFlowRuntimeEnv } from "../../../../../lib/runtime-env";
import { ensureSocialDb, queryOne, run } from "../../../../../lib/db/runtime-db";
import { encryptToken, isEncryptedToken } from "../../../../../lib/socialflow/token-encryption";
import { logRuntimeEvent, runtimeJson } from "../../../../../lib/runtime-observability";

const CANARY_GATE_HEADER = "x-socialflow-canary-gate";
const CANARY_HOST = "socialflow-canary.drako.systems";
const CANARY_RUNTIME_TARGET = "canary";

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

function checkRehardenExecutionContext(request: Request): { allowed: boolean; reason?: string } {
  const env = getSocialFlowRuntimeEnv();
  const runtimeTarget = env?.SOCIALFLOW_RUNTIME_TARGET?.trim().toLowerCase() ?? "";
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

type AuthMeta = {
  mode?: string;
  provider?: string;
  accessToken?: string;
  idToken?: string;
  [key: string]: unknown;
};

type SocialAccountRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  provider: string;
  handle: string;
  display_name: string | null;
  status: string;
  auth_meta: string | null;
  is_primary: number;
  created_at: string;
  updated_at: string;
};

export async function POST(request: Request) {
  try {
    const contextCheck = checkRehardenExecutionContext(request);
    if (!contextCheck.allowed) {
      logRuntimeEvent("warn", "reharden_context_denied", {
        correlationId: request.headers.get("x-correlation-id") ?? undefined,
        reason: contextCheck.reason ?? "context_denied",
      });
      return runtimeJson(
        { error: "Not Found", code: "NOT_FOUND" },
        { status: 404 },
        { request }
      );
    }

    // CRITICAL: Require canary gate token
    const gateCheck = checkCanaryGate(request);
    if (!gateCheck.allowed) {
      logRuntimeEvent("warn", "reharden_gate_denied", {
        correlationId: request.headers.get("x-correlation-id") ?? undefined,
      });
      return runtimeJson(
        { error: "Forbidden", code: "GATE_REQUIRED" },
        { status: 403 },
        { request }
      );
    }

    logRuntimeEvent("log", "reharden_start", {
      correlationId: request.headers.get("x-correlation-id") ?? undefined,
    });

    const db = ensureSocialDb();

    // Fetch canary LinkedIn row with safe SELECT (no *)
    const row = await queryOne<SocialAccountRow>(
      db,
      `SELECT 
        id, tenant_id, saas_id, provider, handle, display_name, 
        status, auth_meta, is_primary, created_at, updated_at
       FROM saas_social_accounts
       WHERE tenant_id = ? AND saas_id = ? AND provider = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      "tenant_socialflow_canary_staff",
      "p2-24i-saas",
      "LINKEDIN"
    );

    if (!row) {
      logRuntimeEvent("warn", "reharden_row_not_found", {
        correlationId: request.headers.get("x-correlation-id") ?? undefined,
      });
      return runtimeJson(
        { error: "LinkedIn row not found", code: "NOT_FOUND" },
        { status: 404 },
        { request }
      );
    }

    // Parse auth_meta
    const authMeta: AuthMeta = row.auth_meta ? JSON.parse(row.auth_meta) : {};
    
    let accessTokenUpdated = false;
    let idTokenUpdated = false;
    let accessTokenStatus = "missing";
    let idTokenStatus = "missing";

    // Check and encrypt accessToken
    if (authMeta.accessToken && typeof authMeta.accessToken === "string") {
      if (isEncryptedToken(authMeta.accessToken)) {
        accessTokenStatus = "already_encrypted";
      } else {
        const encrypted = await encryptToken(authMeta.accessToken);
        if (encrypted) {
          authMeta.accessToken = encrypted;
          accessTokenUpdated = true;
          accessTokenStatus = "encrypted";
        }
      }
    }

    // Check and encrypt idToken
    if (authMeta.idToken && typeof authMeta.idToken === "string") {
      if (isEncryptedToken(authMeta.idToken)) {
        idTokenStatus = "already_encrypted";
      } else {
        const encrypted = await encryptToken(authMeta.idToken);
        if (encrypted) {
          authMeta.idToken = encrypted;
          idTokenUpdated = true;
          idTokenStatus = "encrypted";
        }
      }
    }

    const updated = accessTokenUpdated || idTokenUpdated;

    if (!updated) {
      logRuntimeEvent("log", "reharden_skip", {
        correlationId: request.headers.get("x-correlation-id") ?? undefined,
        reason: "already_encrypted",
        accessTokenStatus,
        idTokenStatus,
      });

      return runtimeJson(
        {
          success: true,
          updated: false,
          reason: "Tokens already encrypted",
          status: {
            accessToken: accessTokenStatus,
            idToken: idTokenStatus,
          },
        },
        { status: 200 },
        { request }
      );
    }

    // Update row with encrypted tokens
    const now = new Date().toISOString();
    await run(
      db,
      `UPDATE saas_social_accounts
       SET auth_meta = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND saas_id = ? AND provider = ?`,
      JSON.stringify(authMeta),
      now,
      row.id,
      row.tenant_id,
      row.saas_id,
      row.provider
    );

    logRuntimeEvent("log", "reharden_complete", {
      correlationId: request.headers.get("x-correlation-id") ?? undefined,
      accessTokenUpdated,
      idTokenUpdated,
    });

    return runtimeJson(
      {
        success: true,
        updated: true,
        changes: {
          accessToken: accessTokenStatus,
          idToken: idTokenStatus,
        },
        row: {
          id: row.id,
          tenantId: row.tenant_id,
          saasId: row.saas_id,
          provider: row.provider,
          status: row.status,
          updatedAt: now,
        },
      },
      { status: 200 },
      { request }
    );

  } catch (error) {
    const errorCode = error instanceof Error && "code" in error
      ? String((error as { code?: unknown }).code ?? "REHARDEN_ERROR")
      : "REHARDEN_ERROR";

    logRuntimeEvent("error", "reharden_error", {
      correlationId: request.headers.get("x-correlation-id") ?? undefined,
      errorCode,
    });

    return runtimeJson(
      {
        error: "Rehardening failed",
        code: "REHARDEN_ERROR",
      },
      { status: 500 },
      { request }
    );
  }
}

export const __rehardenInternals = {
  checkCanaryGate,
  checkRehardenExecutionContext,
  normalizeHost,
};
