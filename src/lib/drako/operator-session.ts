// Sesión del operator de drako.systems: cookie httpOnly "drako_operator_session" con un
// JWT HS256 firmado con Web Crypto (sin dependencias: lo importan src/middleware.ts, las
// rutas /api/operator-login|logout y requireOwnerAccess()).
// Secreto: OPERATOR_SESSION_SECRET o, si no existe, SESSION_SECRET.

export const OPERATOR_SESSION_COOKIE = "drako_operator_session";
export const OPERATOR_SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 días, en segundos

export type OperatorSessionClaims = { sub: string; role: "operator"; iat: number; exp: number };

const encoder = new TextEncoder();

function readSecret(): string | null {
  if (typeof process === "undefined") return null;
  const secret = process.env.OPERATOR_SESSION_SECRET?.trim() || process.env.SESSION_SECRET?.trim() || "";
  return secret.length >= 16 ? secret : null;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signOperatorSession(email: string, now = Date.now()): Promise<string> {
  const secret = readSecret();
  if (!secret) throw new Error("OPERATOR_SESSION_SECRET / SESSION_SECRET not configured");
  const iat = Math.floor(now / 1000);
  const claims: OperatorSessionClaims = { sub: email, role: "operator", iat, exp: iat + OPERATOR_SESSION_MAX_AGE };
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// null si falta, está mal firmada, caducada o el secreto no está configurado.
export async function verifyOperatorSession(token: string | null | undefined, now = Date.now()): Promise<OperatorSessionClaims | null> {
  if (!token) return null;
  const secret = readSecret();
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlDecode(signature),
      encoder.encode(`${header}.${payload}`),
    );
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as OperatorSessionClaims;
    if (claims.role !== "operator" || typeof claims.sub !== "string" || typeof claims.exp !== "number") return null;
    if (claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

// Lee la cookie de una cabecera Cookie cruda (rutas API / requireOwnerAccess).
export function readOperatorSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === OPERATOR_SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
