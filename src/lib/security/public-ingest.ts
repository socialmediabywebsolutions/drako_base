import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { bumpAbuseCounter, extractClientIp } from "@/lib/security/rate-limit";
import { createOrMergeActionFromWebhook } from "@/lib/owner/action-queue-repository";

export type PublicIngestCredential = {
  id: string;
  tenant_id: string;
  saas_id: string | null;
  token: string | null;
  hmac_secret: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicIngestVerification = {
  ok: boolean;
  status?: number;
  error?: string;
  reason?: string;
};

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function getEnvValue(key: string, envOverride?: DracoEnv | null): string | undefined {
  const runtimeEnv = resolveEnvOverride(envOverride);
  const fromEnv = runtimeEnv
    ? (runtimeEnv as unknown as Record<string, string | undefined>)[key]
    : undefined;
  return fromEnv ?? (typeof process !== "undefined" ? process.env[key] : undefined);
}

function isSignatureRequired(envOverride?: DracoEnv | null): boolean {
  const raw = getEnvValue("DRACO_PUBLIC_SIGNATURE_REQUIRED", envOverride);
  return raw ? raw !== "false" : false;
}

function getSignatureMode(envOverride?: DracoEnv | null): "token" | "hmac" {
  const raw = getEnvValue("DRACO_PUBLIC_SIGNATURE_MODE", envOverride);
  return raw === "hmac" ? "hmac" : "token";
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getPublicIngestCredential(params: {
  tenantId: string;
  saasId?: string | null;
  envOverride?: DracoEnv | null;
}): Promise<PublicIngestCredential | null> {
  const rows = await queryAll<PublicIngestCredential>(
    `SELECT id, tenant_id, saas_id, token, hmac_secret, created_at, updated_at
     FROM public_ingest_tokens
     WHERE tenant_id = ? AND saas_id ${params.saasId ? "= ?" : "IS NULL"}
     ORDER BY updated_at DESC LIMIT 1`,
    params.tenantId,
    ...(params.saasId ? [params.saasId] : []),
  );
  return rows[0] ?? null;
}

export async function verifyPublicIngestAccess(params: {
  request: Request;
  tenantId: string;
  saasId?: string | null;
  bodyText: string;
  envOverride?: DracoEnv | null;
  credential?: PublicIngestCredential | null;
  signatureRequired?: boolean;
  signatureMode?: "token" | "hmac";
}): Promise<PublicIngestVerification> {
  const required = params.signatureRequired ?? isSignatureRequired(params.envOverride);
  if (!required) {
    return { ok: true };
  }

  const mode = params.signatureMode ?? getSignatureMode(params.envOverride);
  const credential =
    params.credential ??
    (await getPublicIngestCredential({
      tenantId: params.tenantId,
      saasId: params.saasId ?? null,
      envOverride: params.envOverride,
    }));

  if (!credential) {
    return { ok: false, status: 403, error: "INGEST_CREDENTIALS_MISSING", reason: "missing_credentials" };
  }

  if (mode === "token") {
    const token = params.request.headers.get("x-drako-ingest-token")?.trim() ?? "";
    if (!credential.token || !token || !constantTimeEqual(token, credential.token)) {
      return { ok: false, status: 401, error: "INVALID_INGEST_TOKEN", reason: "invalid_token" };
    }
    return { ok: true };
  }

  const signature = params.request.headers.get("x-drako-signature")?.trim() ?? "";
  if (!credential.hmac_secret || !signature) {
    return { ok: false, status: 401, error: "INVALID_SIGNATURE", reason: "missing_signature" };
  }

  const expected = await signPayload(params.bodyText, credential.hmac_secret);
  if (!constantTimeEqual(signature, expected)) {
    return { ok: false, status: 401, error: "INVALID_SIGNATURE", reason: "signature_mismatch" };
  }

  return { ok: true };
}

export async function registerPublicIngestFailure(params: {
  request: Request;
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string | null;
  route: string;
  reason: string;
  correlationId: string;
  envOverride?: DracoEnv | null;
  recordEvent?: (input: Parameters<typeof recordCampamentoEvent>[0]) => Promise<void>;
  enqueueAction?: (input: Parameters<typeof createOrMergeActionFromWebhook>[0]) => Promise<void>;
}): Promise<void> {
  const ip = extractClientIp(params.request);
  const recordEvent = params.recordEvent ?? recordCampamentoEvent;
  const enqueueAction = params.enqueueAction ?? (async (input: Parameters<typeof createOrMergeActionFromWebhook>[0]) => {
    await createOrMergeActionFromWebhook(input);
  });

  await recordEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    type: "security.ingest.invalid_signature",
    severity: "WARNING",
    source: "PUBLIC_INGEST",
    message: `Public ingest rejected for ${params.route}`,
    metadata: {
      route: params.route,
      ip,
      reason: params.reason,
    },
    correlationId: params.correlationId,
  });

  const abuseKey = ["public_ingest_abuse", params.route, ip].join(":");
  const abuse = await bumpAbuseCounter({ key: abuseKey, windowMs: 10 * 60 * 1000, threshold: 10 });
  if (!abuse.thresholdReached) return;

  await enqueueAction({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    saasSlug: params.saasSlug ?? null,
    category: "SECURITY",
    priority: "HIGH",
    title: "Public abuse suspected",
    description: `Detected repeated public ingest failures on ${params.route}.`,
    source: "PUBLIC_INGEST",
    actionKey: abuseKey.toLowerCase(),
    correlationId: params.correlationId,
    metadata: {
      route: params.route,
      ip,
      reason: params.reason,
      failureCount: abuse.count,
    },
  });

  await recordEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    type: "security.ingest.abuse_detected",
    severity: "CRITICAL",
    source: "PUBLIC_INGEST",
    message: `Public ingest abuse detected on ${params.route}`,
    metadata: {
      route: params.route,
      ip,
      failureCount: abuse.count,
    },
    correlationId: params.correlationId,
  });
}

export async function upsertPublicIngestCredential(params: {
  tenantId: string;
  saasId?: string | null;
  token?: string | null;
  hmacSecret?: string | null;
  envOverride?: DracoEnv | null;
}): Promise<void> {
  const now = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() ?? `ingest_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
  await run(
    `INSERT INTO public_ingest_tokens (id, tenant_id, saas_id, token, hmac_secret, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id, saas_id) DO UPDATE SET token = excluded.token, hmac_secret = excluded.hmac_secret, updated_at = excluded.updated_at`,
    id,
    params.tenantId,
    params.saasId ?? null,
    params.token ?? null,
    params.hmacSecret ?? null,
    now,
    now,
  );
}
