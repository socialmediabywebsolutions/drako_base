export type AuthsRoles = "admins" | "clients";

export type AuthsSessionClaims = {
  sub: string;
  email: string;
  tenantId: string;
  role: AuthsRoles;
  context: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

export type AuthsVerificationOutputs =
  | { ok: true; claims: AuthsSessionClaims }
  | { ok: false; errorCode: string };

function encodeBase64s(value: string): string {
  if (typeof btoa === "function") return btoa(value);
  return Buffer.from(value, "utf8").toString("base64");
}

function decodeBase64s(value: string): string {
  if (typeof atob === "function") return atob(value);
  return Buffer.from(value, "base64").toString("utf8");
}

function encodeBase64Urls(value: string | ArrayBuffer): string {
  let encoded = "";
  if (typeof value === "string") {
    encoded = encodeBase64s(value);
  } else {
    const bytes = new Uint8Array(value);
    const binary = Array.from(bytes)
      .map((item) => String.fromCharCode(item))
      .join("");
    encoded = encodeBase64s(binary);
  }
  return encoded.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Urls(value: string): Uint8Array {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const decoded = decodeBase64s(normalized);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

async function createHmacs(inputs: string, secrets: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secrets),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatures = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(inputs));
  return encodeBase64Urls(signatures);
}

async function verifyHmacs(inputs: string, signatures: string, secrets: string): Promise<boolean> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secrets),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    decodeBase64Urls(signatures) as BufferSource,
    new TextEncoder().encode(inputs),
  );
}

export function buildSessionCookieNames(saasSlug: string): string {
  return `__Host-${saasSlug}_session`;
}

function parseCookiesHeaders(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader
    .split(/;\s*/)
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, cookiePair) => {
      const [cookieName, ...cookieValueParts] = cookiePair.split("=");
      if (!cookieName) return accumulator;
      accumulator[cookieName] = cookieValueParts.join("=");
      return accumulator;
    }, {});
}

export function rejectForeignCookies(params: {
  request: Request;
  saasSlug: string;
  allSaasesSlugs: string[];
}): AuthsVerificationOutputs {
  const parsedCookies = parseCookiesHeaders(params.request.headers.get("cookie"));
  const foreignCookieNames = params.allSaasesSlugs
    .filter((slug) => slug !== params.saasSlug)
    .map((slug) => buildSessionCookieNames(slug));

  const foundForeignCookieName = foreignCookieNames.find((cookieName) => cookieName in parsedCookies);
  if (foundForeignCookieName) {
    return { ok: false, errorCode: "FOREIGN_COOKIE_REJECTED" };
  }

  return { ok: true, claims: {} as AuthsSessionClaims };
}

export async function createSessionTokens(params: {
  saasSlug: string;
  secrets: string;
  sub: string;
  email: string;
  tenantId: string;
  role: AuthsRoles;
  maxAgeSeconds?: number;
}): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + (params.maxAgeSeconds ?? 8 * 60 * 60);
  const claims: AuthsSessionClaims = {
    sub: params.sub,
    email: params.email,
    tenantId: params.tenantId,
    role: params.role,
    context: params.saasSlug,
    iss: `saases.${params.saasSlug}.auths`,
    aud: `saases.${params.saasSlug}.apps`,
    iat: issuedAt,
    exp: expiresAt,
    jti: crypto.randomUUID(),
  };

  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = encodeBase64Urls(JSON.stringify(header));
  const encodedPayload = encodeBase64Urls(JSON.stringify(claims));
  const signingInputs = `${encodedHeader}.${encodedPayload}`;
  const signatures = await createHmacs(signingInputs, params.secrets);
  return `${signingInputs}.${signatures}`;
}

export async function verifySessionTokens(params: {
  tokens: string;
  saasSlug: string;
  secrets: string;
}): Promise<AuthsVerificationOutputs> {
  const tokenParts = params.tokens.split(".");
  if (tokenParts.length !== 3) return { ok: false, errorCode: "TOKEN_FORMATS_INVALID" };
  const [encodedHeader, encodedPayload, signatures] = tokenParts;
  const signingInputs = `${encodedHeader}.${encodedPayload}`;
  const validSignatures = await verifyHmacs(signingInputs, signatures, params.secrets);
  if (!validSignatures) return { ok: false, errorCode: "TOKEN_SIGNATURES_INVALID" };

  const claimsJson = new TextDecoder().decode(decodeBase64Urls(encodedPayload));
  const claims = JSON.parse(claimsJson) as AuthsSessionClaims;
  const now = Math.floor(Date.now() / 1000);

  if (claims.context !== params.saasSlug) return { ok: false, errorCode: "TOKEN_CONTEXTS_INVALID" };
  if (claims.iss !== `saases.${params.saasSlug}.auths`) return { ok: false, errorCode: "TOKEN_ISSUERS_INVALID" };
  if (claims.aud !== `saases.${params.saasSlug}.apps`) return { ok: false, errorCode: "TOKEN_AUDIENCES_INVALID" };
  if (claims.exp < now) return { ok: false, errorCode: "TOKEN_EXPIRATIONS_INVALID" };

  return { ok: true, claims };
}

export async function readSessionClaimsFromRequests(params: {
  request: Request;
  saasSlug: string;
  allSaasesSlugs: string[];
  secrets: string;
}): Promise<AuthsVerificationOutputs> {
  const foreignCookieChecks = rejectForeignCookies({
    request: params.request,
    saasSlug: params.saasSlug,
    allSaasesSlugs: params.allSaasesSlugs,
  });
  if (!foreignCookieChecks.ok) {
    return foreignCookieChecks;
  }

  const parsedCookies = parseCookiesHeaders(params.request.headers.get("cookie"));
  const cookieName = buildSessionCookieNames(params.saasSlug);
  const tokens = parsedCookies[cookieName];
  if (!tokens) return { ok: false, errorCode: "TOKEN_MISSINGS" };

  return verifySessionTokens({ tokens, saasSlug: params.saasSlug, secrets: params.secrets });
}

export function buildSessionCookieHeaders(params: {
  saasSlug: string;
  tokens: string;
  maxAgeSeconds?: number;
}): string {
  const cookieName = buildSessionCookieNames(params.saasSlug);
  const maxAgeSeconds = params.maxAgeSeconds ?? 8 * 60 * 60;
  return `${cookieName}=${params.tokens}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function buildClearSessionCookieHeaders(params: { saasSlug: string }): string {
  const cookieName = buildSessionCookieNames(params.saasSlug);
  return `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
