import type { AuthsContext, AuthsSessionClaims } from "@/lib/auths/types";
import { env as resolveEnv } from "@/lib/cf";
import { resolveSaasSlugForAuthContext } from "@/lib/auths/ssot";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
};

const ISSUER_BY_CONTEXT: Record<AuthsContext, string> = {
  drakos: "drakos.auths",
  mentorias: "mentorias.auths",
  socialflow: "socialflow.auths",
  bases: "bases.auths",
};

const AUDIENCE_BY_CONTEXT: Record<AuthsContext, string> = {
  drakos: "drakos.apps",
  mentorias: "mentorias.apps",
  socialflow: "socialflow.apps",
  bases: "bases.apps",
};

function encodeBase64(input: string): string {
  if (typeof btoa === "function") return btoa(input);
  return Buffer.from(input, "utf8").toString("base64");
}

function decodeBase64(input: string): string {
  if (typeof atob === "function") return atob(input);
  return Buffer.from(input, "base64").toString("utf8");
}

function base64UrlEncode(input: string | ArrayBuffer): string {
  let base64: string;
  if (typeof input === "string") {
    base64 = encodeBase64(input);
  } else {
    const bytes = new Uint8Array(input);
    const binary = Array.from(bytes).map((byte) => String.fromCharCode(byte)).join("");
    base64 = encodeBase64(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const decoded = decodeBase64(base64);
  const bytes = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i += 1) {
    bytes[i] = decoded.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeToString(input: string): string {
  const bytes = base64UrlDecodeToBytes(input);
  return new TextDecoder().decode(bytes);
}

async function signHmac(input: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return base64UrlEncode(signatureBuffer);
}

async function verifyHmac(input: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecodeToBytes(signature) as BufferSource,
    new TextEncoder().encode(input),
  );
}

function readSecret(context: AuthsContext): string {
  const cfEnv = resolveEnv();
  const direct = (name: string) => {
    const fromBindings = cfEnv && typeof (cfEnv as Record<string, unknown>)[name] === "string"
      ? String((cfEnv as Record<string, unknown>)[name])
      : undefined;
    return fromBindings ?? (typeof process !== "undefined" ? process.env[name] : undefined);
  };

  if (context === "drakos") {
    const secret = direct("DRAKOS_AUTHS_SECRET") ?? direct("NEXTAUTH_SECRET");
    if (!secret) throw new Error("DRAKOS_AUTHS_SECRET is not configured");
    return secret;
  }
  if (context === "mentorias") {
    const secret = direct("MENTORIAS_AUTHS_SECRET") ?? direct("SESSION_SECRET");
    if (!secret) throw new Error("MENTORIAS_AUTHS_SECRET is not configured");
    return secret;
  }
  if (context === "socialflow") {
    const secret = direct("SOCIALFLOW_AUTHS_SECRET") ?? direct("SESSION_SECRET");
    if (!secret) throw new Error("SOCIALFLOW_AUTHS_SECRET is not configured");
    return secret;
  }
  const secret = direct("BASES_AUTHS_SECRET") ?? direct("SESSION_SECRET");
  if (!secret) throw new Error("BASES_AUTHS_SECRET is not configured");
  return secret;
}

export function getTokenIssuer(context: AuthsContext): string {
  return ISSUER_BY_CONTEXT[context];
}

export function getTokenAudience(context: AuthsContext): string {
  return AUDIENCE_BY_CONTEXT[context];
}

export async function createAuthsSessionToken(input: {
  context: AuthsContext;
  sub: string;
  email: string;
  tenantId: string;
  role: "owner" | "admin" | "user";
  maxAgeSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = input.maxAgeSeconds ?? 60 * 60 * 8;
  const claims: AuthsSessionClaims = {
    sub: input.sub,
    email: input.email,
    tenantId: input.tenantId,
    role: input.role,
    saasSlug: resolveSaasSlugForAuthContext(input.context),
    context: input.context,
    iss: getTokenIssuer(input.context),
    aud: getTokenAudience(input.context),
    iat: now,
    exp: now + maxAge,
    jti: crypto.randomUUID(),
  };

  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmac(signingInput, readSecret(input.context));
  return `${signingInput}.${signature}`;
}

export async function verifyAuthsSessionToken(
  token: string,
  context: AuthsContext,
): Promise<AuthsSessionClaims | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const valid = await verifyHmac(signingInput, signature, readSecret(context));
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecodeToString(encodedPayload)) as AuthsSessionClaims;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== getTokenIssuer(context)) return null;
    if (payload.aud !== getTokenAudience(context)) return null;
    if (payload.context !== context) return null;
    if (payload.saasSlug !== resolveSaasSlugForAuthContext(context)) return null;
    return payload;
  } catch {
    return null;
  }
}
