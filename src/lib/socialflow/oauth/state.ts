import { env } from "@/lib/cf";

// ---------------------------------------------------------------------------
// Shared, provider-agnostic OAuth connect-flow state: HMAC-signed + single-use
// nonce, consumed atomically against SOCIAL_DB. Used by Meta, LinkedIn, and
// Instagram (see meta/oauth.ts, linkedin/oauth.ts, instagram/oauth.ts) so the
// signing/verification/replay-protection logic exists in exactly one place.
// ---------------------------------------------------------------------------

const STATE_TTL_MS = 15 * 60 * 1000; // 15 min — same window as canary-gate-state.ts
const OAUTH_STATE_SECRET_ENV_KEY = "SOCIALFLOW_OAUTH_STATE_SECRET";
const textEncoder = new TextEncoder();

export type OAuthStateProvider = "meta" | "linkedin" | "instagram";

export class OAuthStateError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "OAuthStateError";
    this.code = code;
  }
}

type OAuthStateClaims = {
  provider: OAuthStateProvider;
  tenantId: string;
  saasId: string;
  redirectTo: string | null;
  // Only Instagram sets this — its authorize dialog must be redeemed against
  // the exact redirect_uri it was shown, so that value is signed alongside
  // the rest of the state instead of being recomputed (and potentially
  // drifting) at callback time. Meta/LinkedIn leave it null.
  callbackUrl: string | null;
  // The user's real browsing origin at /connect time — see normalizeOAuthOrigin
  // above for why this exists. Optional/null for states signed before this field
  // existed, or for a caller that never had a trustworthy origin to capture.
  originUrl: string | null;
  nonce: string;
  iat: number;
};

export type VerifiedOAuthState = {
  ok: true;
  provider: OAuthStateProvider;
  tenantId: string;
  saasId: string;
  redirectTo: string | null;
  callbackUrl: string | null;
  originUrl: string | null;
  nonce: string;
  issuedAt: number;
};

export type RejectedOAuthState = {
  ok: false;
  reason:
    | "state_missing"
    | "state_malformed"
    | "provider_mismatch"
    | "signature_invalid"
    | "state_expired"
    | "nonce_store_unavailable"
    | "nonce_replayed";
};

export type OAuthStateVerification = VerifiedOAuthState | RejectedOAuthState;

// ---------------------------------------------------------------------------
// Redirect-path allowlisting. Must run both when a state is signed (so a
// caller-supplied redirectTo can never end up inside a trusted signature) and
// again when the verified redirectTo is turned into an actual redirect —
// defense in depth: what makes redirectTo trustworthy at that point is that
// WE normalized it before signing, not the signature itself.
// ---------------------------------------------------------------------------

export function normalizeOAuthRedirectPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  return trimmed;
}

// ---------------------------------------------------------------------------
// Origin allowlisting for originUrl — bug fix (Instagram OAuth losing session):
// the callback always lands on the fixed origin registered as Meta's
// redirect_uri (resolveInstagramCallbackUrl's APP_URL), which can differ from
// the origin the user was actually browsing (this app is routed on both
// socialflow.drako.systems and socialcors.com). Session cookies are __Host-
// prefixed (origin-locked), so a final redirect built off the callback
// request's own origin silently drops the cookie whenever those two origins
// differ. originUrl carries the user's REAL origin (captured at /connect time,
// before the Meta detour) through the signed state, so the callback's last
// hop can send them back to the origin their cookie actually belongs to.
// Same trust-boundary reasoning as normalizeOAuthRedirectPath: validate both
// when signing (untrusted request data going in) and when consuming (defense
// in depth — the signature already proves no tampering, this just guards
// against a stale/misconfigured value ever producing an open redirect).
// ---------------------------------------------------------------------------

const ALLOWED_OAUTH_ORIGIN_HOSTS = new Set(["socialflow.drako.systems", "socialcors.com"]);

export function normalizeOAuthOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin; // local dev
    if (!ALLOWED_OAUTH_ORIGIN_HOSTS.has(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Base64url + HMAC helpers — Web Crypto only, must run on Workers, not just Node.
// ---------------------------------------------------------------------------

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeUtf8ToBase64Url(value: string): string {
  return bytesToBase64Url(textEncoder.encode(value));
}

function decodeBase64UrlToUtf8(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function constantTimeEquals(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}

function generateNonce(): string {
  return globalThis.crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Secret resolution — ONE shared secret for all three providers. Deliberately
// independent from META_APP_SECRET / LINKEDIN_CLIENT_SECRET / INSTAGRAM_APP_SECRET:
// this key's only job is CSRF/state integrity, and reusing a provider app
// secret for a second purpose would widen the blast radius of either leaking.
// Requires provisioning SOCIALFLOW_OAUTH_STATE_SECRET in every environment
// (local .dev.vars, staging, prod) before this ships — new secret, not reused.
// ---------------------------------------------------------------------------

function resolveOAuthStateSecret(): string {
  const fromProcess = typeof process !== "undefined" ? process.env[OAUTH_STATE_SECRET_ENV_KEY] : undefined;
  if (typeof fromProcess === "string" && fromProcess.trim()) return fromProcess.trim();

  const bindings = env() as Record<string, unknown> | null;
  const fromBindings = bindings?.[OAUTH_STATE_SECRET_ENV_KEY];
  if (typeof fromBindings === "string" && fromBindings.trim()) return fromBindings.trim();

  throw new OAuthStateError(`${OAUTH_STATE_SECRET_ENV_KEY} is not configured.`, "OAUTH_STATE_SECRET_MISSING");
}

function buildSignatureInput(claims: OAuthStateClaims): string {
  return `${claims.provider}\n${claims.tenantId}\n${claims.saasId}\n${claims.redirectTo ?? ""}\n${claims.callbackUrl ?? ""}\n${claims.originUrl ?? ""}\n${claims.nonce}\n${claims.iat}`;
}

async function signClaims(claims: OAuthStateClaims, secret: string): Promise<string> {
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

// ---------------------------------------------------------------------------
// Public API — sign
// ---------------------------------------------------------------------------

export async function signOAuthState(input: {
  provider: OAuthStateProvider;
  tenantId: string;
  saasId: string;
  redirectTo?: string | null;
  callbackUrl?: string | null;
  originUrl?: string | null;
  now?: number;
}): Promise<string> {
  const secret = resolveOAuthStateSecret();
  const claims: OAuthStateClaims = {
    provider: input.provider,
    tenantId: input.tenantId.trim(),
    saasId: input.saasId.trim(),
    redirectTo: normalizeOAuthRedirectPath(input.redirectTo),
    callbackUrl: input.callbackUrl?.trim() || null,
    originUrl: normalizeOAuthOrigin(input.originUrl),
    nonce: generateNonce(),
    iat: input.now ?? Date.now(),
  };
  const sig = await signClaims(claims, secret);
  return encodeUtf8ToBase64Url(JSON.stringify({ ...claims, sig }));
}

// ---------------------------------------------------------------------------
// Public API — verify (crypto only, no DB — nonce consumption is separate,
// see verifyAndConsumeOAuthState below)
// ---------------------------------------------------------------------------

function decodeClaims(rawState: string): (OAuthStateClaims & { sig: string }) | null {
  try {
    const decoded = decodeBase64UrlToUtf8(rawState.trim());
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const provider = parsed.provider;
    const tenantId = typeof parsed.tenantId === "string" ? parsed.tenantId.trim() : "";
    const saasId = typeof parsed.saasId === "string" ? parsed.saasId.trim() : "";
    const redirectTo = typeof parsed.redirectTo === "string" ? parsed.redirectTo : null;
    const callbackUrl = typeof parsed.callbackUrl === "string" ? parsed.callbackUrl : null;
    // Absent on states signed before this field existed — treated the same as null,
    // never as a decode failure, so in-flight states across a deploy still verify.
    const originUrl = typeof parsed.originUrl === "string" ? parsed.originUrl : null;
    const nonce = typeof parsed.nonce === "string" ? parsed.nonce.trim() : "";
    const iat = typeof parsed.iat === "number" ? parsed.iat : NaN;
    const sig = typeof parsed.sig === "string" ? parsed.sig.trim() : "";

    if (
      (provider !== "meta" && provider !== "linkedin" && provider !== "instagram")
      || !tenantId || !saasId || !nonce || !Number.isFinite(iat) || !sig
    ) {
      return null;
    }

    return { provider, tenantId, saasId, redirectTo, callbackUrl, originUrl, nonce, iat, sig };
  } catch {
    return null;
  }
}

export async function verifyOAuthState(
  rawState: string | null | undefined,
  input: { provider: OAuthStateProvider; now?: number },
): Promise<OAuthStateVerification> {
  if (!rawState?.trim()) return { ok: false, reason: "state_missing" };

  const claims = decodeClaims(rawState);
  if (!claims) return { ok: false, reason: "state_malformed" };
  if (claims.provider !== input.provider) return { ok: false, reason: "provider_mismatch" };

  const now = input.now ?? Date.now();
  if (Math.abs(now - claims.iat) > STATE_TTL_MS) return { ok: false, reason: "state_expired" };

  const secret = resolveOAuthStateSecret();
  const expectedSig = await signClaims(
    {
      provider: claims.provider,
      tenantId: claims.tenantId,
      saasId: claims.saasId,
      redirectTo: claims.redirectTo,
      callbackUrl: claims.callbackUrl,
      originUrl: claims.originUrl,
      nonce: claims.nonce,
      iat: claims.iat,
    },
    secret,
  );
  if (!constantTimeEquals(expectedSig, claims.sig)) return { ok: false, reason: "signature_invalid" };

  return {
    ok: true,
    provider: claims.provider,
    tenantId: claims.tenantId,
    saasId: claims.saasId,
    redirectTo: normalizeOAuthRedirectPath(claims.redirectTo),
    callbackUrl: claims.callbackUrl,
    originUrl: normalizeOAuthOrigin(claims.originUrl),
    nonce: claims.nonce,
    issuedAt: claims.iat,
  };
}

// ---------------------------------------------------------------------------
// Public API — atomic single-use nonce consumption (SOCIAL_DB). A verified
// signature alone is replayable: an attacker who captures a legit callback
// URL (proxy log, shared referrer, browser history sync) can redeem it a
// second time until the nonce is atomically claimed here.
// ---------------------------------------------------------------------------

async function consumeOAuthStateNonce(db: D1Database, verified: VerifiedOAuthState): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO socialflow_oauth_state_nonces (nonce, provider, tenant_id, saas_id, issued_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(verified.nonce, verified.provider, verified.tenantId, verified.saasId, verified.issuedAt)
    .run();

  return ((result?.meta as { changes?: number })?.changes ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Public API — verify + consume in one call. Callback handlers should call
// ONLY this, never verifyOAuthState directly, or replay protection is a no-op.
// Fails closed: if SOCIAL_DB isn't bound, the connect attempt is rejected
// rather than silently degrading to signature-only (TTL-only) protection —
// that would quietly weaken the exact guarantee this design exists for.
// ---------------------------------------------------------------------------

export async function verifyAndConsumeOAuthState(
  rawState: string | null | undefined,
  input: { provider: OAuthStateProvider; now?: number },
): Promise<OAuthStateVerification> {
  const verified = await verifyOAuthState(rawState, input);
  if (!verified.ok) return verified;

  const bindings = env() as Record<string, unknown> | null;
  const socialDb = bindings?.SOCIAL_DB as D1Database | undefined;
  if (!socialDb) return { ok: false, reason: "nonce_store_unavailable" };

  const consumed = await consumeOAuthStateNonce(socialDb, verified);
  if (!consumed) return { ok: false, reason: "nonce_replayed" };

  return verified;
}
