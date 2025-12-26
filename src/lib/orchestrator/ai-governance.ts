import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";

export type AiCircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type AiUsageCounter = {
  key: string;
  tokens_in: number;
  tokens_out: number;
  requests_count: number;
  updated_at: string;
};

export type AiRateLimitBucket = {
  key: string;
  window_start: number;
  count: number;
  updated_at: string;
};

export type AiCircuitBreaker = {
  key: string;
  state: AiCircuitState;
  failure_count: number;
  success_count: number;
  opened_at: string | null;
  cooldown_until: string | null;
  last_error: string | null;
  updated_at: string;
};

type AiGovernanceStore = {
  getUsage: (key: string) => Promise<AiUsageCounter | null>;
  setUsage: (row: AiUsageCounter) => Promise<void>;
  getRateLimitBucket: (key: string) => Promise<AiRateLimitBucket | null>;
  setRateLimitBucket: (row: AiRateLimitBucket) => Promise<void>;
  getCircuitBreaker: (key: string) => Promise<AiCircuitBreaker | null>;
  setCircuitBreaker: (row: AiCircuitBreaker) => Promise<void>;
};

const memoryUsage = new Map<string, AiUsageCounter>();
const memoryRateLimits = new Map<string, AiRateLimitBucket>();
const memoryBreakers = new Map<string, AiCircuitBreaker>();

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function getDb(envOverride?: DracoEnv | null): D1Database | null {
  return resolveEnvOverride(envOverride)?.DRACO_DB ?? null;
}

function toNumber(value: string | undefined | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getEnvValue(key: string, envOverride?: DracoEnv | null): string | undefined {
  const runtimeEnv = resolveEnvOverride(envOverride);
  const fromEnv = runtimeEnv
    ? (runtimeEnv as unknown as Record<string, string | undefined>)[key]
    : undefined;
  return fromEnv ?? (typeof process !== "undefined" ? process.env[key] : undefined);
}

export function getAiGovernanceConfig(envOverride?: DracoEnv | null) {
  const rateLimitEnabledValue = getEnvValue("DRACO_AI_RATE_LIMIT_ENABLED", envOverride);
  return {
    rateLimitEnabled: rateLimitEnabledValue ? rateLimitEnabledValue !== "false" : true,
    rpmPerTenant: toNumber(getEnvValue("DRACO_AI_RPM_PER_TENANT", envOverride), 60),
    rpmPerSaas: toNumber(getEnvValue("DRACO_AI_RPM_PER_SAAS", envOverride), 30),
    monthlyTokensSoft: toNumber(getEnvValue("DRACO_AI_MONTHLY_TOKENS_SOFT", envOverride), 200_000),
    monthlyTokensHard: toNumber(getEnvValue("DRACO_AI_MONTHLY_TOKENS_HARD", envOverride), 300_000),
    breakerFailureThreshold: toNumber(getEnvValue("DRACO_AI_CB_FAILURE_THRESHOLD", envOverride), 5),
    breakerCooldownSeconds: toNumber(getEnvValue("DRACO_AI_CB_COOLDOWN_SECONDS", envOverride), 300),
    breakerHalfOpenTrials: toNumber(getEnvValue("DRACO_AI_CB_HALF_OPEN_TRIALS", envOverride), 2),
  };
}

export function createInMemoryAiGovernanceStore(): AiGovernanceStore {
  return {
    async getUsage(key) {
      return memoryUsage.get(key) ?? null;
    },
    async setUsage(row) {
      memoryUsage.set(row.key, row);
    },
    async getRateLimitBucket(key) {
      return memoryRateLimits.get(key) ?? null;
    },
    async setRateLimitBucket(row) {
      memoryRateLimits.set(row.key, row);
    },
    async getCircuitBreaker(key) {
      return memoryBreakers.get(key) ?? null;
    },
    async setCircuitBreaker(row) {
      memoryBreakers.set(row.key, row);
    },
  };
}

const defaultStore = createInMemoryAiGovernanceStore();

async function getUsageFromDb(params: { key: string; envOverride?: DracoEnv | null }): Promise<AiUsageCounter | null> {
  if (!getDb(params.envOverride)) return null;
  const rows = await queryAll<AiUsageCounter>(
    "SELECT key, tokens_in, tokens_out, requests_count, updated_at FROM ai_usage_counters WHERE key = ? LIMIT 1",
    params.key,
  );
  return rows[0] ?? null;
}

async function setUsageInDb(params: { row: AiUsageCounter; envOverride?: DracoEnv | null }): Promise<void> {
  if (!getDb(params.envOverride)) return;
  const row = params.row;
  await run(
    `INSERT INTO ai_usage_counters (key, tokens_in, tokens_out, requests_count, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       tokens_in = excluded.tokens_in,
       tokens_out = excluded.tokens_out,
       requests_count = excluded.requests_count,
       updated_at = excluded.updated_at`,
    row.key,
    row.tokens_in,
    row.tokens_out,
    row.requests_count,
    row.updated_at,
  );
}

async function getRateLimitBucketFromDb(params: {
  key: string;
  envOverride?: DracoEnv | null;
}): Promise<AiRateLimitBucket | null> {
  if (!getDb(params.envOverride)) return null;
  const rows = await queryAll<AiRateLimitBucket>(
    "SELECT key, window_start, count, updated_at FROM ai_rate_limit_buckets WHERE key = ? LIMIT 1",
    params.key,
  );
  return rows[0] ?? null;
}

async function setRateLimitBucketInDb(params: {
  row: AiRateLimitBucket;
  envOverride?: DracoEnv | null;
}): Promise<void> {
  if (!getDb(params.envOverride)) return;
  const row = params.row;
  await run(
    `INSERT INTO ai_rate_limit_buckets (key, window_start, count, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count, updated_at = excluded.updated_at`,
    row.key,
    row.window_start,
    row.count,
    row.updated_at,
  );
}

async function getCircuitBreakerFromDb(params: {
  key: string;
  envOverride?: DracoEnv | null;
}): Promise<AiCircuitBreaker | null> {
  if (!getDb(params.envOverride)) return null;
  const rows = await queryAll<AiCircuitBreaker>(
    `SELECT key, state, failure_count, success_count, opened_at, cooldown_until, last_error, updated_at
     FROM ai_circuit_breakers
     WHERE key = ?
     LIMIT 1`,
    params.key,
  );
  return rows[0] ?? null;
}

async function setCircuitBreakerInDb(params: {
  row: AiCircuitBreaker;
  envOverride?: DracoEnv | null;
}): Promise<void> {
  if (!getDb(params.envOverride)) return;
  const row = params.row;
  await run(
    `INSERT INTO ai_circuit_breakers (key, state, failure_count, success_count, opened_at, cooldown_until, last_error, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       state = excluded.state,
       failure_count = excluded.failure_count,
       success_count = excluded.success_count,
       opened_at = excluded.opened_at,
       cooldown_until = excluded.cooldown_until,
       last_error = excluded.last_error,
       updated_at = excluded.updated_at`,
    row.key,
    row.state,
    row.failure_count,
    row.success_count,
    row.opened_at,
    row.cooldown_until,
    row.last_error,
    row.updated_at,
  );
}

async function getStoreUsage(params: {
  key: string;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiUsageCounter | null> {
  const store = params.store ?? defaultStore;
  return (await store.getUsage(params.key)) ?? (await getUsageFromDb(params));
}

async function setStoreUsage(params: {
  row: AiUsageCounter;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<void> {
  const store = params.store ?? defaultStore;
  await store.setUsage(params.row);
  if (getDb(params.envOverride)) {
    await setUsageInDb({ row: params.row, envOverride: params.envOverride });
  }
}

async function getStoreRateLimit(params: {
  key: string;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiRateLimitBucket | null> {
  const store = params.store ?? defaultStore;
  return (await store.getRateLimitBucket(params.key)) ?? (await getRateLimitBucketFromDb(params));
}

async function setStoreRateLimit(params: {
  row: AiRateLimitBucket;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<void> {
  const store = params.store ?? defaultStore;
  await store.setRateLimitBucket(params.row);
  if (getDb(params.envOverride)) {
    await setRateLimitBucketInDb({ row: params.row, envOverride: params.envOverride });
  }
}

async function getStoreCircuitBreaker(params: {
  key: string;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiCircuitBreaker | null> {
  const store = params.store ?? defaultStore;
  return (await store.getCircuitBreaker(params.key)) ?? (await getCircuitBreakerFromDb(params));
}

async function setStoreCircuitBreaker(params: {
  row: AiCircuitBreaker;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<void> {
  const store = params.store ?? defaultStore;
  await store.setCircuitBreaker(params.row);
  if (getDb(params.envOverride)) {
    await setCircuitBreakerInDb({ row: params.row, envOverride: params.envOverride });
  }
}

export function buildMonthlyUsageKey(params: { tenantId: string; saasSlug: string | null; now?: Date }): string {
  const now = params.now ?? new Date();
  const yyyymm = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${params.tenantId}:${params.saasSlug ?? "global"}:${yyyymm}`;
}

export function buildRateLimitKey(params: {
  tenantId: string;
  saasSlug: string | null;
  route: string;
  windowStart: number;
}): string {
  return `${params.tenantId}:${params.saasSlug ?? "global"}:${params.route}:${params.windowStart}`;
}

export function buildCircuitBreakerKey(params: { tenantId: string; saasSlug: string | null; provider: string }): string {
  return `${params.tenantId}:${params.saasSlug ?? "global"}:${params.provider}`;
}

export async function consumeAiRateLimit(params: {
  tenantId: string;
  saasSlug: string | null;
  route: string;
  limit: number;
  windowMs: number;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<{ allowed: boolean; count: number; resetAt: string }> {
  const now = Date.now();
  const windowStart = Math.floor(now / params.windowMs) * params.windowMs;
  const key = buildRateLimitKey({
    tenantId: params.tenantId,
    saasSlug: params.saasSlug,
    route: params.route,
    windowStart,
  });
  const existing = await getStoreRateLimit({ key, envOverride: params.envOverride, store: params.store });
  const count = existing && existing.window_start === windowStart ? existing.count + 1 : 1;
  const row: AiRateLimitBucket = {
    key,
    window_start: windowStart,
    count,
    updated_at: new Date(now).toISOString(),
  };
  await setStoreRateLimit({ row, envOverride: params.envOverride, store: params.store });
  const resetAt = new Date(windowStart + params.windowMs).toISOString();
  return { allowed: count <= params.limit, count, resetAt };
}

export async function bumpAiAbuseCounter(params: {
  key: string;
  threshold: number;
  windowMs: number;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<{ count: number; thresholdReached: boolean }> {
  const now = Date.now();
  const windowStart = Math.floor(now / params.windowMs) * params.windowMs;
  const bucketKey = `abuse:${params.key}:${windowStart}`;
  const existing = await getStoreRateLimit({ key: bucketKey, envOverride: params.envOverride, store: params.store });
  const count = existing && existing.window_start === windowStart ? existing.count + 1 : 1;
  const row: AiRateLimitBucket = {
    key: bucketKey,
    window_start: windowStart,
    count,
    updated_at: new Date(now).toISOString(),
  };
  await setStoreRateLimit({ row, envOverride: params.envOverride, store: params.store });
  return { count, thresholdReached: count >= params.threshold };
}

export async function getUsageCounter(params: {
  key: string;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiUsageCounter> {
  const existing = await getStoreUsage(params);
  if (existing) return existing;
  return {
    key: params.key,
    tokens_in: 0,
    tokens_out: 0,
    requests_count: 0,
    updated_at: new Date().toISOString(),
  };
}

export async function incrementUsageCounter(params: {
  key: string;
  tokensIn: number;
  tokensOut: number;
  requests: number;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiUsageCounter> {
  const existing = await getUsageCounter({ key: params.key, envOverride: params.envOverride, store: params.store });
  const updated: AiUsageCounter = {
    key: params.key,
    tokens_in: existing.tokens_in + params.tokensIn,
    tokens_out: existing.tokens_out + params.tokensOut,
    requests_count: existing.requests_count + params.requests,
    updated_at: new Date().toISOString(),
  };
  await setStoreUsage({ row: updated, envOverride: params.envOverride, store: params.store });
  return updated;
}

export async function getCircuitBreaker(params: {
  key: string;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiCircuitBreaker> {
  const existing = await getStoreCircuitBreaker(params);
  if (existing) return existing;
  return {
    key: params.key,
    state: "CLOSED",
    failure_count: 0,
    success_count: 0,
    opened_at: null,
    cooldown_until: null,
    last_error: null,
    updated_at: new Date().toISOString(),
  };
}

export async function updateCircuitBreaker(params: {
  row: AiCircuitBreaker;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<void> {
  await setStoreCircuitBreaker(params);
}

export function estimateTokensForPrompt(text: string): number {
  const approxCharacters = text?.length ?? 0;
  return Math.max(1, Math.ceil(approxCharacters / 4));
}

export function isCircuitOpen(breaker: AiCircuitBreaker): boolean {
  if (breaker.state !== "OPEN") return false;
  if (!breaker.cooldown_until) return true;
  return new Date(breaker.cooldown_until).getTime() > Date.now();
}

export function canAttemptHalfOpen(breaker: AiCircuitBreaker, trials: number): boolean {
  if (breaker.state !== "HALF_OPEN") return true;
  const attempts = breaker.success_count + breaker.failure_count;
  return attempts < trials;
}

export async function transitionBreakerToHalfOpen(params: {
  key: string;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiCircuitBreaker> {
  const now = new Date().toISOString();
  const breaker = await getCircuitBreaker(params);
  const updated: AiCircuitBreaker = {
    ...breaker,
    state: "HALF_OPEN",
    success_count: 0,
    failure_count: 0,
    cooldown_until: null,
    updated_at: now,
  };
  await updateCircuitBreaker({ row: updated, envOverride: params.envOverride, store: params.store });
  return updated;
}

export async function recordCircuitBreakerSuccess(params: {
  key: string;
  trials: number;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<AiCircuitBreaker> {
  const now = new Date().toISOString();
  const breaker = await getCircuitBreaker(params);
  if (breaker.state === "HALF_OPEN") {
    const successCount = breaker.success_count + 1;
    const shouldClose = successCount >= params.trials;
    const updated: AiCircuitBreaker = {
      ...breaker,
      state: shouldClose ? "CLOSED" : "HALF_OPEN",
      success_count: shouldClose ? 0 : successCount,
      failure_count: shouldClose ? 0 : breaker.failure_count,
      opened_at: shouldClose ? null : breaker.opened_at,
      cooldown_until: shouldClose ? null : breaker.cooldown_until,
      last_error: shouldClose ? null : breaker.last_error,
      updated_at: now,
    };
    await updateCircuitBreaker({ row: updated, envOverride: params.envOverride, store: params.store });
    return updated;
  }

  if (breaker.state === "OPEN") {
    return breaker;
  }

  if (breaker.failure_count > 0) {
    const updated: AiCircuitBreaker = {
      ...breaker,
      failure_count: 0,
      success_count: 0,
      last_error: null,
      updated_at: now,
    };
    await updateCircuitBreaker({ row: updated, envOverride: params.envOverride, store: params.store });
    return updated;
  }

  return breaker;
}

export async function recordCircuitBreakerFailure(params: {
  key: string;
  threshold: number;
  cooldownSeconds: number;
  error: string;
  envOverride?: DracoEnv | null;
  store?: AiGovernanceStore;
}): Promise<{ breaker: AiCircuitBreaker; opened: boolean }> {
  const now = new Date();
  const breaker = await getCircuitBreaker(params);
  const failureCount = breaker.failure_count + 1;
  const shouldOpen = failureCount >= params.threshold;
  const cooldownUntil = shouldOpen ? new Date(now.getTime() + params.cooldownSeconds * 1000).toISOString() : breaker.cooldown_until;
  const updated: AiCircuitBreaker = {
    ...breaker,
    state: shouldOpen ? "OPEN" : breaker.state,
    failure_count: failureCount,
    success_count: shouldOpen ? 0 : breaker.success_count,
    opened_at: shouldOpen ? now.toISOString() : breaker.opened_at,
    cooldown_until: shouldOpen ? cooldownUntil : breaker.cooldown_until,
    last_error: params.error,
    updated_at: now.toISOString(),
  };
  await updateCircuitBreaker({ row: updated, envOverride: params.envOverride, store: params.store });
  return { breaker: updated, opened: shouldOpen };
}
