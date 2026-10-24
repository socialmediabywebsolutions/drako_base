# Workers Multi-SaaS Generated Files

## packages/shared/platforms-failures.ts

```ts
export function detectPagesExecutions(runtimeEnv: Record<string, unknown>): boolean {
  return Boolean(
    runtimeEnv.CF_PAGES === "1" ||
      runtimeEnv.CF_PAGES_ENVIRONMENT ||
      runtimeEnv.CF_PAGES_URL ||
      runtimeEnv.CF_PAGES_BRANCH ||
      runtimeEnv.CF_PAGES_COMMIT_SHA,
  );
}

export function buildWorkersOnlyFailures(workerName: string): Response {
  return Response.json(
    {
      ok: false,
      errorCode: "WORKERS_ONLY_ENFORCEMENT",
      message: "This runtime is Workers-only and rejects Pages executions.",
      workerName,
    },
    { status: 503 },
  );
}

```

## packages/shared/hosts-fencings.ts

```ts
export type HostsFencingsOutputs =
  | { ok: true; hostName: string }
  | { ok: false; response: Response };

function normalizeHostName(hostValue: string | null): string {
  if (!hostValue) return "";
  const firstPart = hostValue.split(",")[0]?.trim().toLowerCase() ?? "";
  const hostName = firstPart.split(":")[0] ?? "";
  return hostName.startsWith("www.") ? hostName.slice(4) : hostName;
}

export function resolveHostNameFromRequests(request: Request): string {
  const forwardedHostName = normalizeHostName(request.headers.get("x-forwarded-host"));
  const headerHostName = normalizeHostName(request.headers.get("host"));
  const urlHostName = (() => {
    try {
      return normalizeHostName(new URL(request.url).host);
    } catch {
      return "";
    }
  })();
  return forwardedHostName || headerHostName || urlHostName;
}

export function enforceHostsFencings(params: {
  request: Request;
  allowedHostNames: string[];
  workerName: string;
}): HostsFencingsOutputs {
  const requestedHostName = resolveHostNameFromRequests(params.request);
  const normalizedAllowedHostNames = params.allowedHostNames.map((value) => normalizeHostName(value));
  if (!requestedHostName || !normalizedAllowedHostNames.includes(requestedHostName)) {
    return {
      ok: false,
      response: Response.json(
        {
          ok: false,
          errorCode: "HOSTS_FENCINGS_REJECTED",
          workerName: params.workerName,
          requestedHostName,
          allowedHostNames: normalizedAllowedHostNames,
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, hostName: requestedHostName };
}

```

## packages/shared/auths-isolations.ts

```ts
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

```

## packages/shared/dashboards-templates.ts

```ts
function buildSharedStyles(): string {
  return `
    :root {
      --bg-primary: #0b111a;
      --bg-secondary: #121b27;
      --bg-card: #192537;
      --text-primary: #e7eef8;
      --text-secondary: #9db0c7;
      --accent-primary: #38bdf8;
      --accent-muted: rgba(56, 189, 248, 0.18);
      --border-primary: rgba(157, 176, 199, 0.2);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", "Inter", sans-serif;
      background: radial-gradient(circle at top right, #182437 0%, var(--bg-primary) 48%);
      color: var(--text-primary);
      min-height: 100vh;
    }
    .shells {
      width: min(1080px, calc(100vw - 48px));
      margin: 40px auto;
      padding: 24px;
      border: 1px solid var(--border-primary);
      border-radius: 20px;
      background: linear-gradient(180deg, rgba(25, 37, 55, 0.95), rgba(11, 17, 26, 0.96));
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.32);
    }
    .heads {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .titles { margin: 0; font-size: 28px; }
    .badges {
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--accent-primary);
      color: var(--accent-primary);
      background: var(--accent-muted);
      font-size: 12px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      font-weight: 700;
    }
    .grids {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 14px;
    }
    .cards {
      border: 1px solid var(--border-primary);
      border-radius: 14px;
      padding: 14px;
      background: var(--bg-card);
    }
    .labels {
      font-size: 11px;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
      font-weight: 700;
    }
    .values { margin: 0; font-size: 20px; font-weight: 700; }
    .foots {
      margin-top: 18px;
      color: var(--text-secondary);
      font-size: 13px;
    }
    a.links {
      color: var(--accent-primary);
      text-decoration: none;
      font-weight: 700;
    }
  `;
}

export function renderClientDashboards(params: {
  saasSlug: string;
  workerName: string;
  hostName: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.saasSlug} clients dashboards</title>
  <style>${buildSharedStyles()}</style>
</head>
<body>
  <main class="shells">
    <header class="heads">
      <div>
        <h1 class="titles">${params.saasSlug} clients dashboards</h1>
        <p class="foots">Workers-only runtime served by ${params.workerName}</p>
      </div>
      <span class="badges">${params.hostName}</span>
    </header>
    <section class="grids">
      <article class="cards"><div class="labels">active campaigns</div><p class="values">24</p></article>
      <article class="cards"><div class="labels">monthly usage</div><p class="values">73%</p></article>
      <article class="cards"><div class="labels">automation jobs</div><p class="values">112</p></article>
    </section>
    <p class="foots">Open <a class="links" href="/admins">admins dashboards</a> or check <a class="links" href="/api/health">/api/health</a>.</p>
  </main>
</body>
</html>`;
}

export function renderAdminDashboards(params: {
  saasSlug: string;
  workerName: string;
  hostName: string;
}): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${params.saasSlug} admins dashboards</title>
  <style>${buildSharedStyles()}</style>
</head>
<body>
  <main class="shells">
    <header class="heads">
      <div>
        <h1 class="titles">${params.saasSlug} admins dashboards</h1>
        <p class="foots">Control tower mode with tenant guardrails and host fencing</p>
      </div>
      <span class="badges">${params.workerName}</span>
    </header>
    <section class="grids">
      <article class="cards"><div class="labels">tenants</div><p class="values">8</p></article>
      <article class="cards"><div class="labels">error budgets</div><p class="values">99.97%</p></article>
      <article class="cards"><div class="labels">auth isolation</div><p class="values">enforced</p></article>
    </section>
    <p class="foots">Host: ${params.hostName}. Open <a class="links" href="/clients">clients dashboards</a>.</p>
  </main>
</body>
</html>`;
}

```

## packages/shared/saases-catalogs.ts

```ts
export const SAAS_SLUGS = [
  "drakos",
  "mentorias",
  "bases",
  "socialflows",
  "cryptos",
  "invoices",
  "analytics",
  "automations",
] as const;

export type SaasesSlugs = (typeof SAAS_SLUGS)[number];

export type SaasesCatalogs = {
  saasSlug: SaasesSlugs;
  workerName: string;
  domainName: string;
  authsSecretName: string;
  requiredSecretsNames: string[];
  requiredBindingsNames: string[];
};

export const SAASES_CATALOGS: Record<SaasesSlugs, SaasesCatalogs> = {
  drakos: {
    saasSlug: "drakos",
    workerName: "saas-drakos-prod",
    domainName: "drakos.drako.systems",
    authsSecretName: "DRAKOS_AUTHS_SECRET",
    requiredSecretsNames: ["DRAKOS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  mentorias: {
    saasSlug: "mentorias",
    workerName: "saas-mentorias-prod",
    domainName: "mentorias.drako.systems",
    authsSecretName: "MENTORIAS_AUTHS_SECRET",
    requiredSecretsNames: ["MENTORIAS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  bases: {
    saasSlug: "bases",
    workerName: "saas-bases-prod",
    domainName: "bases.drako.systems",
    authsSecretName: "BASES_AUTHS_SECRET",
    requiredSecretsNames: ["BASES_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  socialflows: {
    saasSlug: "socialflows",
    workerName: "saas-socialflows-prod",
    domainName: "socialflows.drako.systems",
    authsSecretName: "SOCIALFLOWS_AUTHS_SECRET",
    requiredSecretsNames: ["SOCIALFLOWS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  cryptos: {
    saasSlug: "cryptos",
    workerName: "saas-cryptos-prod",
    domainName: "cryptos.drako.systems",
    authsSecretName: "CRYPTOS_AUTHS_SECRET",
    requiredSecretsNames: ["CRYPTOS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  invoices: {
    saasSlug: "invoices",
    workerName: "saas-invoices-prod",
    domainName: "invoices.drako.systems",
    authsSecretName: "INVOICES_AUTHS_SECRET",
    requiredSecretsNames: ["INVOICES_AUTHS_SECRET", "STRIPE_WEBHOOK_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  analytics: {
    saasSlug: "analytics",
    workerName: "saas-analytics-prod",
    domainName: "analytics.drako.systems",
    authsSecretName: "ANALYTICS_AUTHS_SECRET",
    requiredSecretsNames: ["ANALYTICS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
  automations: {
    saasSlug: "automations",
    workerName: "saas-automations-prod",
    domainName: "automations.drako.systems",
    authsSecretName: "AUTOMATIONS_AUTHS_SECRET",
    requiredSecretsNames: ["AUTOMATIONS_AUTHS_SECRET", "GIT_SHA"],
    requiredBindingsNames: ["SAASES_DB", "SAASES_CACHE", "SAASES_STORAGE", "SAASES_EVENTS"],
  },
};

```

## packages/shared/workers-handlers.ts

```ts
import {
  buildClearSessionCookieHeaders,
  buildSessionCookieHeaders,
  createSessionTokens,
  readSessionClaimsFromRequests,
  type AuthsRoles,
} from "./auths-isolations";
import { renderAdminDashboards, renderClientDashboards } from "./dashboards-templates";
import { enforceHostsFencings } from "./hosts-fencings";
import { buildWorkersOnlyFailures, detectPagesExecutions } from "./platforms-failures";

export type WorkersHandlersConfig = {
  saasSlug: string;
  workerName: string;
  domainName: string;
  aliasDomainNames?: string[];
  authsSecretName: string;
  allSaasesSlugs: string[];
};

export type WorkersHandlersEnv = Record<string, unknown> & {
  GIT_SHA?: string;
};

function buildJsonResponses(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function readSecrets(runtimeEnv: WorkersHandlersEnv, secretName: string): string {
  const secretValue = runtimeEnv[secretName];
  return typeof secretValue === "string" ? secretValue : "";
}

async function readJsonBodies(request: Request): Promise<Record<string, unknown>> {
  return (await request.json().catch(() => ({}))) as Record<string, unknown>;
}

export function createWorkersHandlers(config: WorkersHandlersConfig) {
  const allowedHostNames = [config.domainName, ...(config.aliasDomainNames ?? [])];

  return {
    async fetch(request: Request, runtimeEnv: WorkersHandlersEnv): Promise<Response> {
      if (detectPagesExecutions(runtimeEnv)) {
        return buildWorkersOnlyFailures(config.workerName);
      }

      const hostFencings = enforceHostsFencings({ request, allowedHostNames, workerName: config.workerName });
      if (hostFencings.ok === false) return hostFencings.response;

      const requestUrl = new URL(request.url);
      const requestPathName = requestUrl.pathname;
      const requestMethod = request.method.toUpperCase();
      const authsSecrets = readSecrets(runtimeEnv, config.authsSecretName);

      if (!authsSecrets) {
        return buildJsonResponses(
          {
            ok: false,
            errorCode: "AUTHS_SECRETS_MISSINGS",
            workerName: config.workerName,
            authsSecretName: config.authsSecretName,
          },
          500,
        );
      }

      if (requestMethod === "GET" && requestPathName === "/api/health") {
        return buildJsonResponses({
          ok: true,
          host: hostFencings.hostName,
          resolvedContext: config.saasSlug,
          workerName: config.workerName,
          gitSha: typeof runtimeEnv.GIT_SHA === "string" ? runtimeEnv.GIT_SHA : "unknown",
          workersOnly: true,
        });
      }

      if (requestMethod === "POST" && requestPathName === "/api/auths/logins") {
        const body = await readJsonBodies(request);
        const email = String(body.email ?? "").trim().toLowerCase();
        const sub = String(body.sub ?? body.userId ?? crypto.randomUUID());
        const tenantId = String(body.tenantId ?? "default-tenants");
        const role = String(body.role ?? "clients") as AuthsRoles;
        if (!email) {
          return buildJsonResponses({ ok: false, errorCode: "EMAILS_REQUIREDS" }, 400);
        }

        const token = await createSessionTokens({
          saasSlug: config.saasSlug,
          secrets: authsSecrets,
          sub,
          email,
          tenantId,
          role: role === "admins" ? "admins" : "clients",
        });

        return buildJsonResponses(
          {
            ok: true,
            context: config.saasSlug,
            workerName: config.workerName,
            host: hostFencings.hostName,
          },
          200,
          {
            "set-cookie": buildSessionCookieHeaders({ saasSlug: config.saasSlug, tokens: token }),
          },
        );
      }

      if (requestMethod === "POST" && requestPathName === "/api/auths/logouts") {
        return buildJsonResponses(
          { ok: true, context: config.saasSlug, workerName: config.workerName },
          200,
          {
            "set-cookie": buildClearSessionCookieHeaders({ saasSlug: config.saasSlug }),
          },
        );
      }

      if (requestMethod === "GET" && requestPathName === "/api/auths/sessions") {
        const sessionResult = await readSessionClaimsFromRequests({
          request,
          saasSlug: config.saasSlug,
          allSaasesSlugs: config.allSaasesSlugs,
          secrets: authsSecrets,
        });
        if (sessionResult.ok === false) {
          return buildJsonResponses(
            { ok: false, errorCode: sessionResult.errorCode, context: config.saasSlug },
            401,
          );
        }

        return buildJsonResponses({ ok: true, claims: sessionResult.claims, context: config.saasSlug });
      }

      if ((requestMethod === "GET" && requestPathName === "/") || requestPathName === "/clients") {
        return new Response(
          renderClientDashboards({
            saasSlug: config.saasSlug,
            workerName: config.workerName,
            hostName: hostFencings.hostName,
          }),
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          },
        );
      }

      if (requestMethod === "GET" && requestPathName === "/admins") {
        return new Response(
          renderAdminDashboards({
            saasSlug: config.saasSlug,
            workerName: config.workerName,
            hostName: hostFencings.hostName,
          }),
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
          },
        );
      }

      if (requestMethod === "GET" && requestPathName === "/logins") {
        return Response.redirect(new URL("/clients", request.url), 308);
      }

      return buildJsonResponses(
        {
          ok: false,
          errorCode: "ROUTINGS_NOT_FOUNDS",
          context: config.saasSlug,
          workerName: config.workerName,
          pathName: requestPathName,
        },
        404,
      );
    },
  };
}

```

## workers/drakos/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "drakos",
  workerName: "saas-drakos-prod",
  domainName: "drakos.drako.systems",
  aliasDomainNames: ["drako.systems"],
  authsSecretName: "DRAKOS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/drakos/wrangler.workers.toml

```toml
name = "saas-drakos-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "drakos.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_drakos_prod_db"
database_id = "REPLACE_WITH_DRAKOS_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_DRAKOS_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-drakos-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-drakos-prod-events"

[vars]
SAASES_SLUG = "drakos"
SAASES_DOMAIN = "drakos.drako.systems"
AUTHS_SECRETS_NAME = "DRAKOS_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## workers/mentorias/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "mentorias",
  workerName: "saas-mentorias-prod",
  domainName: "mentorias.drako.systems",
  aliasDomainNames: ["mentoria.drako.systems"],
  authsSecretName: "MENTORIAS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/mentorias/wrangler.workers.toml

```toml
name = "saas-mentorias-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "mentorias.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_mentorias_prod_db"
database_id = "REPLACE_WITH_MENTORIAS_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_MENTORIAS_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-mentorias-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-mentorias-prod-events"

[vars]
SAASES_SLUG = "mentorias"
SAASES_DOMAIN = "mentorias.drako.systems"
AUTHS_SECRETS_NAME = "MENTORIAS_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## workers/bases/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "bases",
  workerName: "saas-bases-prod",
  domainName: "bases.drako.systems",
  aliasDomainNames: ["base.drako.systems", "admin.drako.systems"],
  authsSecretName: "BASES_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/bases/wrangler.workers.toml

```toml
name = "saas-bases-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "bases.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_bases_prod_db"
database_id = "REPLACE_WITH_BASES_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_BASES_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-bases-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-bases-prod-events"

[vars]
SAASES_SLUG = "bases"
SAASES_DOMAIN = "bases.drako.systems"
AUTHS_SECRETS_NAME = "BASES_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## workers/socialflows/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "socialflows",
  workerName: "saas-socialflows-prod",
  domainName: "socialflows.drako.systems",
  authsSecretName: "SOCIALFLOWS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/socialflows/wrangler.workers.toml

```toml
name = "saas-socialflows-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "socialflows.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_socialflows_prod_db"
database_id = "REPLACE_WITH_SOCIALFLOWS_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_SOCIALFLOWS_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-socialflows-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-socialflows-prod-events"

[vars]
SAASES_SLUG = "socialflows"
SAASES_DOMAIN = "socialflows.drako.systems"
AUTHS_SECRETS_NAME = "SOCIALFLOWS_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## workers/cryptos/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "cryptos",
  workerName: "saas-cryptos-prod",
  domainName: "cryptos.drako.systems",
  authsSecretName: "CRYPTOS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/cryptos/wrangler.workers.toml

```toml
name = "saas-cryptos-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "cryptos.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_cryptos_prod_db"
database_id = "REPLACE_WITH_CRYPTOS_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_CRYPTOS_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-cryptos-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-cryptos-prod-events"

[vars]
SAASES_SLUG = "cryptos"
SAASES_DOMAIN = "cryptos.drako.systems"
AUTHS_SECRETS_NAME = "CRYPTOS_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## workers/invoices/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "invoices",
  workerName: "saas-invoices-prod",
  domainName: "invoices.drako.systems",
  authsSecretName: "INVOICES_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/invoices/wrangler.workers.toml

```toml
name = "saas-invoices-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "invoices.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_invoices_prod_db"
database_id = "REPLACE_WITH_INVOICES_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_INVOICES_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-invoices-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-invoices-prod-events"

[vars]
SAASES_SLUG = "invoices"
SAASES_DOMAIN = "invoices.drako.systems"
AUTHS_SECRETS_NAME = "INVOICES_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## workers/analytics/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "analytics",
  workerName: "saas-analytics-prod",
  domainName: "analytics.drako.systems",
  authsSecretName: "ANALYTICS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/analytics/wrangler.workers.toml

```toml
name = "saas-analytics-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "analytics.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_analytics_prod_db"
database_id = "REPLACE_WITH_ANALYTICS_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_ANALYTICS_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-analytics-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-analytics-prod-events"

[vars]
SAASES_SLUG = "analytics"
SAASES_DOMAIN = "analytics.drako.systems"
AUTHS_SECRETS_NAME = "ANALYTICS_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## workers/automations/src/workers.ts

```ts
import { createWorkersHandlers } from "../../../packages/shared/workers-handlers";
import { SAAS_SLUGS } from "../../../packages/shared/saases-catalogs";

const handlers = createWorkersHandlers({
  saasSlug: "automations",
  workerName: "saas-automations-prod",
  domainName: "automations.drako.systems",
  authsSecretName: "AUTOMATIONS_AUTHS_SECRET",
  allSaasesSlugs: [...SAAS_SLUGS],
});

export default handlers;

```

## workers/automations/wrangler.workers.toml

```toml
name = "saas-automations-prod"
main = "src/workers.ts"
compatibility_date = "2024-11-01"
workers_dev = false

[[routes]]
pattern = "automations.drako.systems/*"
custom_domain = true

# Recommended strategy: one D1 per SaaS worker.
[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_automations_prod_db"
database_id = "REPLACE_WITH_AUTOMATIONS_DB_ID"

[[kv_namespaces]]
binding = "SAASES_CACHE"
id = "REPLACE_WITH_AUTOMATIONS_KV_ID"

[[r2_buckets]]
binding = "SAASES_STORAGE"
bucket_name = "saas-automations-prod-storage"

[[queues.producers]]
binding = "SAASES_EVENTS"
queue = "saas-automations-prod-events"

[vars]
SAASES_SLUG = "automations"
SAASES_DOMAIN = "automations.drako.systems"
AUTHS_SECRETS_NAME = "AUTOMATIONS_AUTHS_SECRET"
WORKERS_ONLY_MODE = "true"

```

## apps/drakos/routings.json

```json
{
  "saasesSlug": "drakos",
  "domainName": "drakos.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/drakos/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>drakos clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>drakos clients dashboards</h1>
    <p>Workers-only UI starter for drakos.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/drakos/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>drakos admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>drakos admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/mentorias/routings.json

```json
{
  "saasesSlug": "mentorias",
  "domainName": "mentorias.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/mentorias/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>mentorias clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>mentorias clients dashboards</h1>
    <p>Workers-only UI starter for mentorias.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/mentorias/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>mentorias admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>mentorias admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/bases/routings.json

```json
{
  "saasesSlug": "bases",
  "domainName": "bases.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/bases/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>bases clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>bases clients dashboards</h1>
    <p>Workers-only UI starter for bases.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/bases/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>bases admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>bases admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/socialflows/routings.json

```json
{
  "saasesSlug": "socialflows",
  "domainName": "socialflows.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/socialflows/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>socialflows clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>socialflows clients dashboards</h1>
    <p>Workers-only UI starter for socialflows.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/socialflows/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>socialflows admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>socialflows admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/cryptos/routings.json

```json
{
  "saasesSlug": "cryptos",
  "domainName": "cryptos.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/cryptos/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>cryptos clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>cryptos clients dashboards</h1>
    <p>Workers-only UI starter for cryptos.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/cryptos/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>cryptos admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>cryptos admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/invoices/routings.json

```json
{
  "saasesSlug": "invoices",
  "domainName": "invoices.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/invoices/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>invoices clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>invoices clients dashboards</h1>
    <p>Workers-only UI starter for invoices.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/invoices/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>invoices admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>invoices admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/analytics/routings.json

```json
{
  "saasesSlug": "analytics",
  "domainName": "analytics.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/analytics/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>analytics clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>analytics clients dashboards</h1>
    <p>Workers-only UI starter for analytics.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/analytics/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>analytics admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>analytics admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/automations/routings.json

```json
{
  "saasesSlug": "automations",
  "domainName": "automations.drako.systems",
  "dashboardsRoutes": {
    "clients": "/clients",
    "admins": "/admins"
  },
  "healthsRoute": "/api/health",
  "authsRoutes": {
    "logins": "/api/auths/logins",
    "logouts": "/api/auths/logouts",
    "sessions": "/api/auths/sessions"
  }
}

```

## apps/automations/dashboards/clients.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>automations clients dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>automations clients dashboards</h1>
    <p>Workers-only UI starter for automations.drako.systems.</p>
    <p>Open <a href="/admins">admins dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## apps/automations/dashboards/admins.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>automations admins dashboards</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Inter, sans-serif; background: #0b111a; color: #e7eef8; }
    main { max-width: 920px; margin: 48px auto; padding: 24px; border: 1px solid #2a3a52; border-radius: 18px; background: #111b29; }
    h1 { margin: 0 0 8px; }
    p { color: #9db0c7; }
    a { color: #38bdf8; }
  </style>
</head>
<body>
  <main>
    <h1>automations admins dashboards</h1>
    <p>Workers-only admins surface with isolated host fencing and auths checks.</p>
    <p>Open <a href="/clients">clients dashboards</a> or <a href="/api/health">healths checks</a>.</p>
  </main>
</body>
</html>

```

## scripts/check-workers-multi-saas.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

saases=(
  "drakos:drakos.drako.systems"
  "mentorias:mentorias.drako.systems"
  "bases:bases.drako.systems"
  "socialflows:socialflows.drako.systems"
  "cryptos:cryptos.drako.systems"
  "invoices:invoices.drako.systems"
  "analytics:analytics.drako.systems"
  "automations:automations.drako.systems"
)

echo "== Health checks =="
for item in "${saases[@]}"; do
  slug="${item%%:*}"
  domain="${item##*:}"
  echo "-- ${slug} (${domain})"
  curl -sS "https://${domain}/api/health" | jq '{ok,host,resolvedContext,workerName,gitSha,workersOnly}'
  echo

done

echo "== Host fencing checks (expected 403) =="
for item in "${saases[@]}"; do
  slug="${item%%:*}"
  domain="${item##*:}"
  echo "-- ${slug} rejecting foreign Host header"
  curl -sS -i "https://${domain}/api/health" -H 'Host: invalid.drako.systems' | head -n 1
  echo

done

```

## docs/runbooks/workers-multi-saas-plan.md

```md
# Executable Plan: Multi-Worker SaaS Holding (Workers-first)

## Goal
Move from single-worker monolith to one Worker per SaaS while keeping Campamento Base as control tower.

## Phase 1: Prepare Shared Runtime Modules

1. Add shared modules under `packages/shared/`:
   - `platforms-failures.ts` for Workers-only fail-closed checks.
   - `hosts-fencings.ts` for strict host allowlist enforcement.
   - `auths-isolations.ts` for isolated cookies and JWT checks.
   - `dashboards-templates.ts` for client/admin dark UI surfaces.
   - `workers-handlers.ts` for standard worker routing and health endpoints.

## Phase 2: Provision 8 SaaS Workers

Create worker folders:

- `workers/drakos/`
- `workers/mentorias/`
- `workers/bases/`
- `workers/socialflows/`
- `workers/cryptos/`
- `workers/invoices/`
- `workers/analytics/`
- `workers/automations/`

Each worker contains:

- `src/workers.ts`
- `wrangler.workers.toml`

## Phase 3: SaaS Apps Scaffolding

Create per-SaaS app metadata:

- `apps/<slug>/routings.json`
- `apps/<slug>/dashboards/clients.html`
- `apps/<slug>/dashboards/admins.html`

## Phase 4: Deploy and Validate

Deploy commands:

```bash
cd workers/drakos && wrangler deploy --config wrangler.workers.toml
cd workers/mentorias && wrangler deploy --config wrangler.workers.toml
cd workers/bases && wrangler deploy --config wrangler.workers.toml
cd workers/socialflows && wrangler deploy --config wrangler.workers.toml
cd workers/cryptos && wrangler deploy --config wrangler.workers.toml
cd workers/invoices && wrangler deploy --config wrangler.workers.toml
cd workers/analytics && wrangler deploy --config wrangler.workers.toml
cd workers/automations && wrangler deploy --config wrangler.workers.toml
```

Health checks:

```bash
curl -sS https://drakos.drako.systems/api/health | jq .
curl -sS https://mentorias.drako.systems/api/health | jq .
curl -sS https://bases.drako.systems/api/health | jq .
```

Expected:

- `workersOnly: true`
- `resolvedContext` equals slug
- `workerName` equals worker

## Phase 5: Traffic Migration Without Downtime

1. Add new custom domains to each worker.
2. Keep monolith worker active during verification window.
3. Enable temporary `308` redirects from legacy domains.
4. Move DNS per domain in batches.
5. Tail logs per worker (`wrangler tail`) and validate auth isolation.
6. Disable legacy endpoints after stable cutover.

```

## docs/runbooks/workers-multi-saas.md

```md
# Workers Multi-SaaS Runbook (Workers-only)

## Scope
This runbook defines a Cloudflare Workers-first architecture with one Worker per SaaS for a holding model.

- Runtime policy: Workers-only.
- Pages policy: fail closed when `CF_PAGES_*` variables are present.
- Isolation policy: host fencing + auth isolation per SaaS worker.

## Initial SaaS Catalogs (8)

| SaaS slug | Worker name | Domain | Auth secret | Optional secrets | Bindings |
|---|---|---|---|---|---|
| drakos | saas-drakos-prod | drakos.drako.systems | DRAKOS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| mentorias | saas-mentorias-prod | mentorias.drako.systems | MENTORIAS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| bases | saas-bases-prod | bases.drako.systems | BASES_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| socialflows | saas-socialflows-prod | socialflows.drako.systems | SOCIALFLOWS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| cryptos | saas-cryptos-prod | cryptos.drako.systems | CRYPTOS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| invoices | saas-invoices-prod | invoices.drako.systems | INVOICES_AUTHS_SECRET | STRIPE_WEBHOOK_SECRET, GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| analytics | saas-analytics-prod | analytics.drako.systems | ANALYTICS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |
| automations | saas-automations-prod | automations.drako.systems | AUTOMATIONS_AUTHS_SECRET | GIT_SHA | SAASES_DB, SAASES_CACHE, SAASES_STORAGE, SAASES_EVENTS |

## Directory Layouts

- `apps/<saas-slug>/` for SaaS-specific routings and dashboards templates.
- `workers/<saas-slug>/wrangler.workers.toml` for worker-specific deploy settings.
- `packages/shared/` for host fencing, auth isolation, and workers handlers.
- `docs/runbooks/` for deployment and operations guides.

## Create a New SaaS Worker

1. Copy one worker folder:
   - `cp -R workers/drakos workers/<new-slug>`
2. Update `workers/<new-slug>/src/workers.ts`:
   - `saasSlug`, `workerName`, `domainName`, `authsSecretName`.
3. Update `workers/<new-slug>/wrangler.workers.toml`:
   - worker `name`, `routes`, and bindings IDs.
4. Add app metadata:
   - `apps/<new-slug>/routings.json`
   - `apps/<new-slug>/dashboards/clients.html`
   - `apps/<new-slug>/dashboards/admins.html`

## Add Custom Domains

For each worker:

1. Open Cloudflare Dashboard -> Workers & Pages -> target Worker.
2. Go to `Settings` -> `Domains & Routes`.
3. Add custom domain `<slug>.drako.systems`.
4. Confirm there is no Pages project using the same domain.

## DNS Configurations

1. In Cloudflare DNS zone `drako.systems`, verify worker custom domain records exist.
2. Remove any stale records pointing to legacy runtimes.
3. Confirm no record points to Pages endpoints.

## Secrets Configurations

Per worker directory:

```bash
cd workers/<slug>
wrangler secret put <SLUG>_AUTHS_SECRET
wrangler secret put GIT_SHA
```

For invoices worker:

```bash
cd workers/invoices
wrangler secret put INVOICES_AUTHS_SECRET
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put GIT_SHA
```

## Deploy Commands

Run per SaaS:

```bash
cd workers/drakos && wrangler deploy --config wrangler.workers.toml
cd workers/mentorias && wrangler deploy --config wrangler.workers.toml
cd workers/bases && wrangler deploy --config wrangler.workers.toml
cd workers/socialflows && wrangler deploy --config wrangler.workers.toml
cd workers/cryptos && wrangler deploy --config wrangler.workers.toml
cd workers/invoices && wrangler deploy --config wrangler.workers.toml
cd workers/analytics && wrangler deploy --config wrangler.workers.toml
cd workers/automations && wrangler deploy --config wrangler.workers.toml
```

## Healths Verifications

Each worker exposes `/api/health` with `host`, `resolvedContext`, `workerName`, and `gitSha`.

```bash
curl -sS https://drakos.drako.systems/api/health | jq .
curl -sS https://mentorias.drako.systems/api/health | jq .
curl -sS https://bases.drako.systems/api/health | jq .
bash scripts/check-workers-multi-saas.sh
```

Expected fields:

- `workersOnly: true`
- `resolvedContext` matches SaaS slug
- `workerName` matches deployed worker

## Host Fencings Guarantees

- Each worker accepts only its own domain (plus explicit migration aliases).
- Foreign hosts return `403 HOSTS_FENCINGS_REJECTED`.

Validation example:

```bash
curl -i https://drakos.drako.systems/api/health -H 'Host: mentorias.drako.systems'
```

## Auth Isolation Guarantees

- Cookie name: `__Host-<slug>_session`.
- Token checks: `aud`, `iss`, `context`, and `exp`.
- Foreign SaaS cookies are rejected with `401 FOREIGN_COOKIE_REJECTED`.

Validation examples:

```bash
# Login and set cookie
curl -i -X POST https://drakos.drako.systems/api/auths/logins \
  -H 'content-type: application/json' \
  --data '{"email":"owner@drakos.io","tenantId":"tenant-drakos","role":"admins"}'

# Read current session
curl -i https://drakos.drako.systems/api/auths/sessions --cookie '__Host-drakos_session=<TOKEN>'

# Foreign cookie should fail
curl -i https://drakos.drako.systems/api/auths/sessions --cookie '__Host-mentorias_session=<TOKEN>'
```

## Migration Checklist (Monolith to Multi-Worker, no downtime)

1. Deploy all new workers before switching traffic.
2. Attach secondary domains first (`<slug>.drako.systems`) and run health checks.
3. Keep old monolith worker serving legacy domains temporarily.
4. Add `308` redirects from legacy hostnames to new SaaS domains.
5. Validate auths cookies on each domain:
   - login on source domain;
   - verify no session on other domain.
6. Switch primary DNS traffic per domain in this order:
   - low-risk SaaS first (analytics, socialflows)
   - then mentorias, invoices, cryptos, automations
   - finally drakos and bases.
7. Observe each worker with:

```bash
cd workers/<slug>
wrangler tail --format pretty
```

8. Disable legacy auth endpoints in monolith after stable cutover window.

## Recommended Data Strategy

- Preferred: one D1 database per SaaS worker.
- Transitional: shared D1 with strict `saas_slug` + `tenant_id` boundaries.
- Never allow cross-SaaS auth tables or shared session stores.

## Control Tower Boundaries (Campamento Base)

- `bases` worker acts as control tower only.
- It consumes aggregate telemetry and orchestration events.
- It does not accept final-user auth from other SaaS domains.

```

