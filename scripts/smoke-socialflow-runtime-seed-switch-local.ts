import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runValidateSocialflowRuntimeSeedLocal } from "./validate-socialflow-runtime-seed-local";

type RuntimeSeedLocalSmokeOptions = {
  baseUrl: string;
  timeoutMs: number;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  authBinding: string;
};

type CoreSeedFixture = {
  createdForSmoke: boolean;
  tenantId: string;
  coreSaasId: string;
  coreSlug: "socialflow" | "socialflows";
  socialSlug: "socialflow" | "socialflows";
  coreName: string;
};

type SocialSeedFixture = {
  rowId: string;
  saasId: string;
  slug: "socialflow" | "socialflows";
};

type SessionFixture = {
  email: string;
  cookie: string;
};

type ProfileResponse = {
  ok?: boolean;
  profile?: {
    saasId?: string;
    brandName?: string;
  };
};

type SetupStatusResponse = {
  ok?: boolean;
  status?: {
    saasId?: string;
    tenantId?: string;
  };
};

type SaasIdentityAssertionInput = {
  actualSaasId: string | null | undefined;
  label: "social-first" | "core-fallback";
  allowedSaasIds: string[];
  forbiddenSaasIds?: string[];
};

const CORE_SLUGS = ["socialflow", "socialflows"] as const;
const RUNTIME_COOKIE_HINT = "socialflow";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const SMOKE_USER_AGENT = "drako-socialflow-runtime-seed-smoke/1.0";
const HEALTH_WARMUP_ATTEMPTS = 20;
const ROUTE_WARMUP_ATTEMPTS = 10;
const SESSION_RETRY_ATTEMPTS = 4;
const PROFILE_RETRY_ATTEMPTS = 6;
const SETUP_STATUS_RETRY_ATTEMPTS = 6;
const RETRY_BASE_DELAY_MS = 250;
const RETRY_MAX_DELAY_MS = 1_500;
const RETRYABLE_FETCH_ERROR_MARKERS = [
  "SOCIALFLOW_RUNTIME_SEED_SMOKE_HTTP_FETCH_FAILED",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_SOCKET",
  "SocketError",
  "other side closed",
  "fetch failed",
] as const;

type RetryRequestOptions = {
  label: string;
  timeoutMs: number;
  maxAttempts: number;
  retryOnStatuses?: number[];
};

function parseArgs(argv: string[]): RuntimeSeedLocalSmokeOptions {
  const baseUrlArg = argv.find((value) => value.startsWith("--base-url="));
  const timeoutArg = argv.find((value) => value.startsWith("--timeout-ms="));
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const authArg = argv.find((value) => value.startsWith("--auth-binding="));

  const timeoutMs = timeoutArg ? Number(timeoutArg.slice("--timeout-ms=".length)) : 20_000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000) {
    throw new Error("SOCIALFLOW_RUNTIME_SEED_SMOKE_INVALID_TIMEOUT");
  }

  return {
    baseUrl: baseUrlArg ? baseUrlArg.slice("--base-url=".length) : "http://127.0.0.1:8787",
    timeoutMs,
    configPath: configArg ? configArg.slice("--config=".length) : "apps/socialflow-runtime/wrangler.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    authBinding: authArg ? authArg.slice("--auth-binding=".length) : "SOCIALFLOW_AUTHS_DB",
  };
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("SOCIALFLOW_RUNTIME_SEED_SMOKE_BASE_URL_MISSING");
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_BASE_URL_INVALID_PROTOCOL:${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_BASE_URL_NOT_LOCAL:${hostname}`);
  }

  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function asSqlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function runWranglerJson(binding: string, configPath: string, sql: string): unknown[] {
  try {
    const output = execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding,
        "--local",
        "--config",
        configPath,
        "--command",
        sql,
        "--json",
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const parsed = JSON.parse(output) as Array<{ results?: unknown[] }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }
    return parsed[0]?.results ?? [];
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function runWranglerCommand(binding: string, configPath: string, sql: string): void {
  try {
    execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding,
        "--local",
        "--config",
        configPath,
        "--command",
        sql,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_WRANGLER_COMMAND_FAILED:${stderr.trim()}`);
  }
}

function assertTableExists(binding: string, configPath: string, tableName: string): void {
  const rows = runWranglerJson(
    binding,
    configPath,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ${asSqlValue(tableName)};`,
  ) as Array<{ name?: string }>;

  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_TABLE_MISSING:${binding}:${tableName}`);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timeout:${timeoutMs}`)), timeoutMs);
  try {
    try {
      const headers = new Headers(init.headers);
      if (!headers.has("user-agent")) {
        headers.set("user-agent", SMOKE_USER_AGENT);
      }
      headers.set("connection", "close");
      headers.set("cache-control", "no-store");

      return await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? `${error.name}:${error.message}` : String(error);
      const cause = error instanceof Error && "cause" in error
        ? (error as Error & { cause?: unknown }).cause
        : undefined;
      const causeMessage = cause instanceof Error
        ? `${cause.name}:${cause.message}`
        : cause == null
          ? "none"
          : String(cause);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_HTTP_TIMEOUT:${url}:timeoutMs=${timeoutMs}`);
      }
      throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_HTTP_FETCH_FAILED:${url}:${message}:cause=${causeMessage}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function isRetryableFetchError(message: string): boolean {
  return RETRYABLE_FETCH_ERROR_MARKERS.some((marker) => message.includes(marker));
}

function isRetryableStatus(status: number, retryOnStatuses: number[] | undefined): boolean {
  return retryOnStatuses?.includes(status) ?? false;
}

function resolveBackoffMs(attempt: number): number {
  const power = Math.max(0, attempt - 1);
  return Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * (2 ** power));
}

function summarizeBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= 180) {
    return normalized;
  }
  return `${normalized.slice(0, 180)}...`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, options: RetryRequestOptions): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, options.timeoutMs);
      if (isRetryableStatus(response.status, options.retryOnStatuses) && attempt < options.maxAttempts) {
        const body = await readResponseBody(response);
        const delayMs = resolveBackoffMs(attempt);
        console.warn(
          `SOCIALFLOW_RUNTIME_SEED_SMOKE_RETRY ${options.label} attempt=${attempt}/${options.maxAttempts} status=${response.status} waitMs=${delayMs} body=${summarizeBody(body) || "<empty>"}`,
        );
        await sleep(delayMs);
        continue;
      }
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = isRetryableFetchError(message);
      lastError = error instanceof Error ? error : new Error(message);
      if (!retryable || attempt >= options.maxAttempts) {
        throw lastError;
      }

      const delayMs = resolveBackoffMs(attempt);
      console.warn(
        `SOCIALFLOW_RUNTIME_SEED_SMOKE_RETRY ${options.label} attempt=${attempt}/${options.maxAttempts} reason=${message} waitMs=${delayMs}`,
      );
      await sleep(delayMs);
    }
  }

  throw lastError ?? new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_RETRY_EXHAUSTED:${options.label}`);
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function collectSetCookies(headers: Headers): string[] {
  const anyHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof anyHeaders.getSetCookie === "function") {
    const values = anyHeaders.getSetCookie();
    if (values.length > 0) return values;
  }

  const fallback: string[] = [];
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === "set-cookie") {
      fallback.push(value);
    }
  }
  return fallback;
}

function resolveSessionCookie(setCookies: string[]): string {
  for (const rawEntry of setCookies) {
    const firstSegment = rawEntry.split(";")[0]?.replace(/[\r\n]/g, "").trim() ?? "";
    if (!firstSegment) continue;
    const normalized = firstSegment.replace(/^,+\s*/, "");
    if (!normalized.toLowerCase().includes(RUNTIME_COOKIE_HINT)) continue;
    if (!normalized.toLowerCase().includes("session")) continue;
    return normalized;
  }

  throw new Error("SOCIALFLOW_RUNTIME_SEED_SMOKE_SESSION_COOKIE_MISSING");
}

function resolveOppositeSlug(slug: "socialflow" | "socialflows"): "socialflow" | "socialflows" {
  return slug === "socialflow" ? "socialflows" : "socialflow";
}

function normalizeSaasIdentitySet(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const next = value.trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    normalized.push(next);
  }
  return normalized;
}

function assertSaasIdentity(input: SaasIdentityAssertionInput): string {
  const actual = input.actualSaasId?.trim() ?? "";
  if (!actual) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_${input.label.toUpperCase().replace("-", "_")}_SAAS_ID_MISSING`);
  }

  const allowed = normalizeSaasIdentitySet(input.allowedSaasIds);
  if (!allowed.includes(actual)) {
    throw new Error(
      `SOCIALFLOW_RUNTIME_SEED_SMOKE_${input.label.toUpperCase().replace("-", "_")}_UNEXPECTED_SAAS_ID:${actual} allowed=[${allowed.join(",")}]`,
    );
  }

  const forbidden = normalizeSaasIdentitySet(input.forbiddenSaasIds ?? []);
  if (forbidden.includes(actual)) {
    throw new Error(
      `SOCIALFLOW_RUNTIME_SEED_SMOKE_${input.label.toUpperCase().replace("-", "_")}_FORBIDDEN_SAAS_ID:${actual} forbidden=[${forbidden.join(",")}]`,
    );
  }

  return actual;
}

function buildRuntimeId(prefix: string): string {
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}_${Date.now()}_${random}`;
}

function tryInsertDedicatedCoreSeed(options: RuntimeSeedLocalSmokeOptions, slug: "socialflow" | "socialflows"): CoreSeedFixture | null {
  const tenantId = buildRuntimeId("tenant_socialflow_runtime_seed_smoke");
  const coreSaasId = buildRuntimeId("saas_socialflow_runtime_seed_smoke");
  const coreName = `Runtime Seed Core ${slug.toUpperCase()}`;
  const domain = `${slug}-runtime-seed-smoke.local`;
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO saas (id, tenant_id, name, slug, domain, status, created_at)
    VALUES (
      ${asSqlValue(coreSaasId)},
      ${asSqlValue(tenantId)},
      ${asSqlValue(coreName)},
      ${asSqlValue(slug)},
      ${asSqlValue(domain)},
      ${asSqlValue("active")},
      ${asSqlValue(now)}
    );
  `;

  try {
    runWranglerCommand(options.dracoBinding, options.configPath, sql);
    return {
      createdForSmoke: true,
      tenantId,
      coreSaasId,
      coreSlug: slug,
      socialSlug: resolveOppositeSlug(slug),
      coreName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/UNIQUE constraint failed/i.test(message)) {
      return null;
    }
    throw error;
  }
}

function prepareCoreSeedFixture(options: RuntimeSeedLocalSmokeOptions): CoreSeedFixture {
  for (const slug of CORE_SLUGS) {
    const created = tryInsertDedicatedCoreSeed(options, slug);
    if (created) {
      return created;
    }
  }

  throw new Error(
    "SOCIALFLOW_RUNTIME_SEED_SMOKE_CORE_FIXTURE_UNAVAILABLE:unable to create dedicated local saas row with slug socialflow/socialflows. Keep local-only safety and free one slug before retry.",
  );
}

function upsertSocialSeedFixture(
  options: RuntimeSeedLocalSmokeOptions,
  input: { tenantId: string; socialSlug: "socialflow" | "socialflows"; status: "active" | "inactive"; rowId: string; saasId: string; name: string },
): void {
  const now = new Date().toISOString();
  const metadataJson = JSON.stringify({
    source: "runtime_seed_switch_local_smoke",
    name: input.name,
  });

  runWranglerCommand(
    options.socialBinding,
    options.configPath,
    `INSERT INTO socialflow_seed_metadata (
      id, tenant_id, saas_id, slug, domain, status, metadata_json, created_at, updated_at
    ) VALUES (
      ${asSqlValue(input.rowId)},
      ${asSqlValue(input.tenantId)},
      ${asSqlValue(input.saasId)},
      ${asSqlValue(input.socialSlug)},
      ${asSqlValue(`${input.socialSlug}-runtime-seed-smoke.local`)},
      ${asSqlValue(input.status)},
      ${asSqlValue(metadataJson)},
      ${asSqlValue(now)},
      ${asSqlValue(now)}
    )
    ON CONFLICT(tenant_id, saas_id, slug) DO UPDATE SET
      domain = excluded.domain,
      status = excluded.status,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at;`,
  );
}

function cleanupRuntimeWorkspace(options: RuntimeSeedLocalSmokeOptions, tenantId: string): void {
  const statements = [
    `DELETE FROM socialflow_runtime_channel_competitors WHERE tenant_id = ${asSqlValue(tenantId)};`,
    `DELETE FROM socialflow_runtime_channel_assets WHERE tenant_id = ${asSqlValue(tenantId)};`,
    `DELETE FROM socialflow_runtime_channel_profiles WHERE tenant_id = ${asSqlValue(tenantId)};`,
    `DELETE FROM saas_social_posts WHERE tenant_id = ${asSqlValue(tenantId)};`,
    `DELETE FROM saas_social_campaigns WHERE tenant_id = ${asSqlValue(tenantId)};`,
    `DELETE FROM saas_social_accounts WHERE tenant_id = ${asSqlValue(tenantId)};`,
    `DELETE FROM saas_social_channels WHERE tenant_id = ${asSqlValue(tenantId)};`,
  ];

  for (const sql of statements) {
    try {
      runWranglerCommand(options.socialBinding, options.configPath, sql);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/no such table/i.test(message)) {
        continue;
      }
      throw error;
    }
  }
}

async function ensureRuntimeReachable(options: RuntimeSeedLocalSmokeOptions): Promise<void> {
  const healthResponse = await fetchWithRetry(
    `${options.baseUrl}/api/socialflow/runtime/health`,
    {
      method: "GET",
    },
    {
      label: "health",
      timeoutMs: options.timeoutMs,
      maxAttempts: HEALTH_WARMUP_ATTEMPTS,
      retryOnStatuses: [500, 502, 503, 504],
    },
  );

  if (!healthResponse.ok) {
    const body = await readResponseBody(healthResponse);
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_RUNTIME_UNREACHABLE:${healthResponse.status}:${body}`);
  }

  const profileWarmup = await fetchWithRetry(
    `${options.baseUrl}/api/socialflow/profile`,
    {
      method: "GET",
    },
    {
      label: "profile-warmup",
      timeoutMs: options.timeoutMs,
      maxAttempts: ROUTE_WARMUP_ATTEMPTS,
      retryOnStatuses: [500, 502, 503, 504],
    },
  );

  if (profileWarmup.status !== 401 && profileWarmup.status !== 200) {
    const body = await readResponseBody(profileWarmup);
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_PROFILE_WARMUP_UNEXPECTED_STATUS:${profileWarmup.status}:${body}`);
  }

  const setupWarmup = await fetchWithRetry(
    `${options.baseUrl}/api/socialflow/setup/status?saasId=smoke_warmup`,
    {
      method: "GET",
    },
    {
      label: "setup-status-warmup",
      timeoutMs: options.timeoutMs,
      maxAttempts: ROUTE_WARMUP_ATTEMPTS,
      retryOnStatuses: [500, 502, 503, 504],
    },
  );

  if (setupWarmup.status !== 401 && setupWarmup.status !== 200) {
    const body = await readResponseBody(setupWarmup);
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_SETUP_WARMUP_UNEXPECTED_STATUS:${setupWarmup.status}:${body}`);
  }

  console.log(
    `SOCIALFLOW_RUNTIME_SEED_SMOKE_WARMUP health=${healthResponse.status} profileWarmup=${profileWarmup.status} setupWarmup=${setupWarmup.status}`,
  );
}

async function registerSession(options: RuntimeSeedLocalSmokeOptions, tenantId: string): Promise<SessionFixture> {
  const password = "socialflow-runtime-smoke-123";

  for (let attempt = 1; attempt <= SESSION_RETRY_ATTEMPTS; attempt += 1) {
    const email = `${buildRuntimeId("socialflow-runtime-seed-smoke")}@local.dev`;
    try {
      const response = await fetchWithRetry(
        `${options.baseUrl}/api/socialflow/auths/registrations`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-tenant-id": tenantId,
          },
          body: JSON.stringify({
            email,
            password,
            name: "SocialFlow Runtime Seed Smoke",
            tenantId,
          }),
        },
        {
          label: `registration-${attempt}`,
          timeoutMs: options.timeoutMs,
          maxAttempts: 2,
          retryOnStatuses: [500, 502, 503, 504],
        },
      );

      if (response.status !== 201) {
        const body = await readResponseBody(response);
        throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_REGISTRATION_FAILED:${response.status}:${body}`);
      }

      const cookie = resolveSessionCookie(collectSetCookies(response.headers));
      console.log(
        `SOCIALFLOW_RUNTIME_SEED_SMOKE_SESSION_COOKIE_META length=${cookie.length} hasCtl=${/[\r\n]/.test(cookie)} hasLeadingComma=${cookie.startsWith(",")}`,
      );
      return { email, cookie };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= SESSION_RETRY_ATTEMPTS || !isRetryableFetchError(message)) {
        throw error;
      }
      const delayMs = resolveBackoffMs(attempt);
      console.warn(
        `SOCIALFLOW_RUNTIME_SEED_SMOKE_RETRY registration attempt=${attempt}/${SESSION_RETRY_ATTEMPTS} reason=${message} waitMs=${delayMs}`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error("SOCIALFLOW_RUNTIME_SEED_SMOKE_REGISTRATION_EXHAUSTED");
}

async function readProfile(options: RuntimeSeedLocalSmokeOptions, session: SessionFixture, tenantId: string): Promise<ProfileResponse> {
  const response = await fetchWithRetry(
    `${options.baseUrl}/api/socialflow/profile`,
    {
      method: "GET",
      headers: {
        cookie: session.cookie,
        "x-tenant-id": tenantId,
      },
    },
    {
      label: "profile",
      timeoutMs: options.timeoutMs,
      maxAttempts: PROFILE_RETRY_ATTEMPTS,
      retryOnStatuses: [401, 429, 500, 502, 503, 504],
    },
  );

  const body = await readResponseBody(response);
  if (response.status !== 200) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_PROFILE_FAILED:${response.status}:${body}`);
  }

  return JSON.parse(body) as ProfileResponse;
}

async function readSetupStatus(
  options: RuntimeSeedLocalSmokeOptions,
  session: SessionFixture,
  tenantId: string,
  saasId: string,
): Promise<SetupStatusResponse> {
  const response = await fetchWithRetry(
    `${options.baseUrl}/api/socialflow/setup/status?saasId=${encodeURIComponent(saasId)}`,
    {
      method: "GET",
      headers: {
        cookie: session.cookie,
        "x-tenant-id": tenantId,
      },
    },
    {
      label: "setup-status",
      timeoutMs: options.timeoutMs,
      maxAttempts: SETUP_STATUS_RETRY_ATTEMPTS,
      retryOnStatuses: [401, 429, 500, 502, 503, 504],
    },
  );

  const body = await readResponseBody(response);
  if (response.status !== 200) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_SETUP_STATUS_FAILED:${response.status}:${body}`);
  }

  return JSON.parse(body) as SetupStatusResponse;
}

function assertSetupStatusShape(setup: SetupStatusResponse, expectedTenantId: string, expectedSaasId: string): void {
  if (!setup.ok || !setup.status) {
    throw new Error("SOCIALFLOW_RUNTIME_SEED_SMOKE_SETUP_STATUS_INVALID_PAYLOAD");
  }

  if (setup.status.tenantId !== expectedTenantId) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_SETUP_STATUS_TENANT_MISMATCH:${setup.status.tenantId ?? "null"}!=${expectedTenantId}`);
  }

  if ((setup.status.saasId ?? "").trim() !== expectedSaasId) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_SETUP_STATUS_SAAS_MISMATCH:${setup.status.saasId ?? "null"}!=${expectedSaasId}`);
  }
}

function cleanupAuthUser(options: RuntimeSeedLocalSmokeOptions, email: string): void {
  const rows = runWranglerJson(
    options.authBinding,
    options.configPath,
    `SELECT id FROM socialflow_users WHERE email = ${asSqlValue(email)} LIMIT 1;`,
  ) as Array<{ id?: string }>;

  const userId = rows[0]?.id?.trim();
  if (!userId) return;

  runWranglerCommand(
    options.authBinding,
    options.configPath,
    `DELETE FROM socialflow_sessions WHERE user_id = ${asSqlValue(userId)};`,
  );
  runWranglerCommand(
    options.authBinding,
    options.configPath,
    `DELETE FROM socialflow_credentials WHERE user_id = ${asSqlValue(userId)};`,
  );
  runWranglerCommand(
    options.authBinding,
    options.configPath,
    `DELETE FROM socialflow_users WHERE id = ${asSqlValue(userId)};`,
  );
}

function cleanupSocialSeed(options: RuntimeSeedLocalSmokeOptions, tenantId: string, socialSeed: SocialSeedFixture): void {
  runWranglerCommand(
    options.socialBinding,
    options.configPath,
    `DELETE FROM socialflow_seed_metadata
     WHERE tenant_id = ${asSqlValue(tenantId)}
       AND saas_id = ${asSqlValue(socialSeed.saasId)}
       AND slug = ${asSqlValue(socialSeed.slug)};`,
  );
}

function listTenantSocialSeeds(options: RuntimeSeedLocalSmokeOptions, tenantId: string): Array<{
  id: string;
  saas_id: string;
  slug: string;
  status: string;
  updated_at: string;
}> {
  return runWranglerJson(
    options.socialBinding,
    options.configPath,
    `SELECT id, saas_id, slug, coalesce(status, '') as status, coalesce(updated_at, '') as updated_at
     FROM socialflow_seed_metadata
     WHERE tenant_id = ${asSqlValue(tenantId)}
     ORDER BY datetime(updated_at) DESC, rowid DESC;`,
  ) as Array<{
    id: string;
    saas_id: string;
    slug: string;
    status: string;
    updated_at: string;
  }>;
}

function cleanupCoreFixture(options: RuntimeSeedLocalSmokeOptions, core: CoreSeedFixture): void {
  if (!core.createdForSmoke) {
    return;
  }
  runWranglerCommand(
    options.dracoBinding,
    options.configPath,
    `DELETE FROM saas
     WHERE id = ${asSqlValue(core.coreSaasId)}
       AND tenant_id = ${asSqlValue(core.tenantId)};`,
  );
}

export async function runSmokeSocialflowRuntimeSeedSwitchLocal(
  optionsInput: RuntimeSeedLocalSmokeOptions,
): Promise<void> {
  const options: RuntimeSeedLocalSmokeOptions = {
    ...optionsInput,
    baseUrl: normalizeBaseUrl(optionsInput.baseUrl),
  };

  console.log("\n[SocialFlow Runtime Seed Switch Smoke] 1/8 run local validation pack");
  await runValidateSocialflowRuntimeSeedLocal({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });

  console.log("\n[SocialFlow Runtime Seed Switch Smoke] 2/8 verify required local schemas");
  assertTableExists(options.dracoBinding, options.configPath, "saas");
  assertTableExists(options.socialBinding, options.configPath, "socialflow_seed_metadata");
  assertTableExists(options.authBinding, options.configPath, "socialflow_users");
  assertTableExists(options.authBinding, options.configPath, "socialflow_credentials");
  assertTableExists(options.authBinding, options.configPath, "socialflow_sessions");

  console.log("\n[SocialFlow Runtime Seed Switch Smoke] 3/8 verify runtime local health endpoint");
  await ensureRuntimeReachable(options);

  console.log("\n[SocialFlow Runtime Seed Switch Smoke] 4/8 prepare runtime seed fixtures");
  const coreFixture = prepareCoreSeedFixture(options);
  const socialSeed: SocialSeedFixture = {
    rowId: buildRuntimeId("sf_seed_smoke"),
    saasId: buildRuntimeId("saas_social_seed_smoke"),
    slug: coreFixture.socialSlug,
  };
  const socialFirstName = `Runtime Seed Social ${coreFixture.socialSlug.toUpperCase()}`;

  let session: SessionFixture | null = null;

  try {
    console.log("\n[SocialFlow Runtime Seed Switch Smoke] 5/8 register local runtime session");
    session = await registerSession(options, coreFixture.tenantId);

    const tenantSeedsBeforeFallback = listTenantSocialSeeds(options, coreFixture.tenantId);
    console.log(`SOCIALFLOW_RUNTIME_SEED_SMOKE_TENANT_SEEDS_BEFORE_FALLBACK ${JSON.stringify(tenantSeedsBeforeFallback)}`);

    console.log("\n[SocialFlow Runtime Seed Switch Smoke] 6/8 record core-fallback evidence from contract tests");
    console.log(
      "EVIDENCE core-fallback contractTest=tests/lib/socialflow-runtime-seed-contract.test.ts case=keeps_working_when_SOCIAL_DB_read_errors_and_core_fallback_is_available",
    );

    console.log("\n[SocialFlow Runtime Seed Switch Smoke] 7/8 validate profile route with switch ON (social-first)");
    upsertSocialSeedFixture(options, {
      tenantId: coreFixture.tenantId,
      socialSlug: socialSeed.slug,
      status: "active",
      rowId: socialSeed.rowId,
      saasId: socialSeed.saasId,
      name: socialFirstName,
    });
    const tenantSeedsBeforeSocialFirst = listTenantSocialSeeds(options, coreFixture.tenantId);
    console.log(`SOCIALFLOW_RUNTIME_SEED_SMOKE_TENANT_SEEDS_BEFORE_SOCIAL_FIRST ${JSON.stringify(tenantSeedsBeforeSocialFirst)}`);

    const socialFirstProfile = await readProfile(options, session, coreFixture.tenantId);
    const socialFirstSaasId = assertSaasIdentity({
      actualSaasId: socialFirstProfile.profile?.saasId,
      label: "social-first",
      allowedSaasIds: [coreFixture.socialSlug, socialSeed.saasId],
      forbiddenSaasIds: [coreFixture.coreSlug, coreFixture.coreSaasId],
    });
    const socialFirstSetup = await readSetupStatus(options, session, coreFixture.tenantId, socialFirstSaasId);
    assertSetupStatusShape(socialFirstSetup, coreFixture.tenantId, socialFirstSaasId);
    console.log(
      `EVIDENCE social-first profileSaasId=${socialFirstSaasId} allowed=[${coreFixture.socialSlug},${socialSeed.saasId}] forbidden=[${coreFixture.coreSlug},${coreFixture.coreSaasId}] brandName=${socialFirstProfile.profile?.brandName ?? "unknown"}`,
    );
  } finally {
    console.log("\n[SocialFlow Runtime Seed Switch Smoke] 8/8 cleanup local smoke fixtures (best effort)");
    try {
      cleanupRuntimeWorkspace(options, coreFixture.tenantId);
    } catch (error) {
      console.warn("SOCIALFLOW_RUNTIME_SEED_SMOKE_CLEANUP_WARNING_RUNTIME_WORKSPACE", error);
    }

    try {
      cleanupSocialSeed(options, coreFixture.tenantId, socialSeed);
    } catch (error) {
      console.warn("SOCIALFLOW_RUNTIME_SEED_SMOKE_CLEANUP_WARNING_SOCIAL_SEED", error);
    }

    try {
      cleanupCoreFixture(options, coreFixture);
    } catch (error) {
      console.warn("SOCIALFLOW_RUNTIME_SEED_SMOKE_CLEANUP_WARNING_CORE_SEED", error);
    }

    if (session) {
      try {
        cleanupAuthUser(options, session.email);
      } catch (error) {
        console.warn("SOCIALFLOW_RUNTIME_SEED_SMOKE_CLEANUP_WARNING_AUTH_USER", error);
      }
    }
  }

  console.log("\nSOCIALFLOW_RUNTIME_SEED_SWITCH_LOCAL_SMOKE_SUCCESS");
  console.log(`baseUrl=${options.baseUrl}`);
  console.log("switchEnv=SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH=1");
  console.log("validatedRoutes=/api/socialflow/profile,/api/socialflow/setup/status");
}

export async function runSmokeSocialflowRuntimeSeedSwitchLocalCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    await runSmokeSocialflowRuntimeSeedSwitchLocal(options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_LOCAL_SMOKE_ERROR ${message}`);
    if (
      message.includes("SOCIALFLOW_RUNTIME_SEED_BACKFILL_TABLE_MISSING")
      || message.includes("SOCIALFLOW_RUNTIME_SEED_SMOKE_TABLE_MISSING")
    ) {
      console.error(
        "SOCIALFLOW_RUNTIME_SEED_SWITCH_LOCAL_SMOKE_HINT run: pnpm tsx scripts/bootstrap-socialflow-runtime-seed-smoke-local.ts --config=apps/socialflow-runtime/wrangler.toml",
      );
    }
    return 1;
  }
}

async function runCli(): Promise<void> {
  const exitCode = await runSmokeSocialflowRuntimeSeedSwitchLocalCli(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
