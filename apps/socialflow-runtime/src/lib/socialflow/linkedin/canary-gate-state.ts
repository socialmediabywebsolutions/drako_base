const CALLBACK_STATE_TTL_MS = 15 * 60 * 1000;
const textEncoder = new TextEncoder();

type LinkedInGateStateClaims = {
  tenantId?: string | null;
  saasId?: string | null;
  redirectTo?: string | null;
  iat?: number;
  gateSig?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeJsonPayload(rawState: string): Record<string, unknown> | null {
  const value = rawState.trim();
  if (!value) return null;

  if (value.startsWith("{")) {
    try {
      const parsed = JSON.parse(value);
      return isObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  for (const encoding of ["base64url", "base64"] as const) {
    try {
      const decoded = decodeBase64Variant(value, encoding);
      const parsed = JSON.parse(decoded);
      if (isObject(parsed)) return parsed;
    } catch {
      // ignore decode errors
    }
  }

  return null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeUtf8ToBase64Url(value: string): string {
  return bytesToBase64Url(textEncoder.encode(value));
}

function decodeBase64Variant(value: string, encoding: "base64url" | "base64"): string {
  const normalized =
    encoding === "base64url"
      ? value.replace(/-/g, "+").replace(/_/g, "/")
      : value;
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeClaims(payload: Record<string, unknown>): LinkedInGateStateClaims {
  return {
    tenantId: typeof payload.tenantId === "string" && payload.tenantId.trim() ? payload.tenantId.trim() : null,
    saasId: typeof payload.saasId === "string" && payload.saasId.trim() ? payload.saasId.trim() : null,
    redirectTo: typeof payload.redirectTo === "string" && payload.redirectTo.trim() ? payload.redirectTo.trim() : null,
    iat: typeof payload.iat === "number" && Number.isFinite(payload.iat) ? payload.iat : undefined,
    gateSig: typeof payload.gateSig === "string" && payload.gateSig.trim() ? payload.gateSig.trim() : undefined,
  };
}

function buildSignatureInput(claims: Required<Pick<LinkedInGateStateClaims, "tenantId" | "saasId" | "iat">> & Pick<LinkedInGateStateClaims, "redirectTo">) {
  return `${claims.tenantId}\n${claims.saasId}\n${claims.redirectTo ?? ""}\n${claims.iat}`;
}

async function signState(
  claims: Required<Pick<LinkedInGateStateClaims, "tenantId" | "saasId" | "iat">> & Pick<LinkedInGateStateClaims, "redirectTo">,
  secret: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(buildSignatureInput(claims)));
  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEquals(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

export async function encodeLinkedInCanaryGateState(input: {
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
  gateSecret: string;
  now?: number;
}) {
  const issuedAt = input.now ?? Date.now();
  const claims = {
    tenantId: input.tenantId.trim(),
    saasId: input.saasId.trim(),
    redirectTo: input.redirectTo ?? null,
    iat: issuedAt,
  };
  const gateSig = await signState(claims, input.gateSecret);
  const payload = { ...claims, gateSig };
  return encodeUtf8ToBase64Url(JSON.stringify(payload));
}

export async function verifyLinkedInCanaryGateState(rawState: string | null | undefined, gateSecret: string, now = Date.now()) {
  const payload = rawState ? decodeJsonPayload(rawState) : null;
  if (!payload) {
    return { ok: false as const, reason: "state_missing_or_unparseable" };
  }

  const claims = normalizeClaims(payload);
  if (!claims.tenantId || !claims.saasId || !claims.iat || !claims.gateSig) {
    return { ok: false as const, reason: "state_missing_required_claims" };
  }

  if (Math.abs(now - claims.iat) > CALLBACK_STATE_TTL_MS) {
    return { ok: false as const, reason: "state_signature_expired" };
  }

  const expected = await signState(
    {
      tenantId: claims.tenantId,
      saasId: claims.saasId,
      redirectTo: claims.redirectTo ?? null,
      iat: claims.iat,
    },
    gateSecret,
  );

  if (!constantTimeEquals(expected, claims.gateSig)) {
    return { ok: false as const, reason: "state_signature_invalid" };
  }

  return {
    ok: true as const,
    tenantId: claims.tenantId,
    saasId: claims.saasId,
    iat: claims.iat,
  };
}
