import { getSocialFlowRuntimeEnv } from "../runtime-env";
import type { SocialFlowRole, SocialFlowSessionClaims } from "./types";

type JwtHeader = {
  alg: "HS256";
  typ: "JWT";
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
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function base64UrlDecodeToString(input: string): string {
  return new TextDecoder().decode(base64UrlDecodeToBytes(input));
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

function readSecret(): string {
  const runtimeEnv = getSocialFlowRuntimeEnv();
  const secret = runtimeEnv?.SOCIALFLOW_AUTHS_SECRET?.trim() || runtimeEnv?.SESSION_SECRET?.trim() || "";
  if (!secret) {
    throw new Error("SOCIALFLOW_AUTHS_SECRET is not configured");
  }
  return secret;
}

export async function createSocialFlowSessionToken(input: {
  sub: string;
  email: string;
  tenantId: string;
  role: SocialFlowRole;
  maxAgeSeconds?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = input.maxAgeSeconds ?? 60 * 60 * 8;
  const claims: SocialFlowSessionClaims = {
    sub: input.sub,
    email: input.email,
    tenantId: input.tenantId,
    role: input.role,
    saasSlug: "socialflow",
    context: "socialflow",
    iss: "socialflow.auths",
    aud: "socialflow.apps",
    iat: now,
    exp: now + maxAge,
    jti: crypto.randomUUID(),
  };

  const header: JwtHeader = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHmac(signingInput, readSecret());
  return `${signingInput}.${signature}`;
}

export async function verifySocialFlowSessionToken(token: string): Promise<SocialFlowSessionClaims | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const valid = await verifyHmac(signingInput, signature, readSecret());
    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecodeToString(encodedPayload)) as SocialFlowSessionClaims;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.iss !== "socialflow.auths") return null;
    if (payload.aud !== "socialflow.apps") return null;
    if (payload.context !== "socialflow") return null;
    if (payload.saasSlug !== "socialflow") return null;
    return payload;
  } catch {
    return null;
  }
}
