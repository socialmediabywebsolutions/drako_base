import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";

type RateLimitBucket = {
  key: string;
  window_start: number;
  count: number;
  updated_at: string;
};

type RateLimitStore = {
  get: (key: string) => Promise<RateLimitBucket | null>;
  set: (bucket: RateLimitBucket) => Promise<void>;
};

type RateLimitDecision = {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: string;
  limit: number;
};

const defaultMemoryStore = new Map<string, RateLimitBucket>();
const defaultStore: RateLimitStore = {
  async get(key) {
    return defaultMemoryStore.get(key) ?? null;
  },
  async set(bucket) {
    defaultMemoryStore.set(bucket.key, bucket);
  },
};

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

export function createInMemoryRateLimitStore(): RateLimitStore {
  const store = new Map<string, RateLimitBucket>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(bucket) {
      store.set(bucket.key, bucket);
    },
  };
}

function getDb(envOverride?: DracoEnv | null): D1Database | null {
  const runtimeEnv = resolveEnvOverride(envOverride);
  return runtimeEnv?.DRACO_DB ?? null;
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

export function getPublicRateLimitConfig(envOverride?: DracoEnv | null): {
  enabled: boolean;
  rpm: number;
  burst: number;
  windowMs: number;
} {
  const enabledValue = getEnvValue("DRACO_RATE_LIMIT_ENABLED", envOverride);
  const enabled = enabledValue ? enabledValue !== "false" : true;
  const rpm = toNumber(getEnvValue("DRACO_PUBLIC_RPM", envOverride), 60);
  const burst = toNumber(getEnvValue("DRACO_PUBLIC_BURST", envOverride), 20);
  return { enabled, rpm, burst, windowMs: 60_000 };
}

async function getBucketFromDb(params: {
  key: string;
  envOverride?: DracoEnv | null;
}): Promise<RateLimitBucket | null> {
  const db = getDb(params.envOverride);
  if (!db) return null;
  const rows = await queryAll<RateLimitBucket>(
    "SELECT key, window_start, count, updated_at FROM rate_limit_buckets WHERE key = ? LIMIT 1",
    params.key,
  );
  return rows[0] ?? null;
}

async function setBucketInDb(params: {
  bucket: RateLimitBucket;
  envOverride?: DracoEnv | null;
}): Promise<void> {
  const db = getDb(params.envOverride);
  if (!db) return;
  const { bucket } = params;
  await run(
    `INSERT INTO rate_limit_buckets (key, window_start, count, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET window_start = excluded.window_start, count = excluded.count, updated_at = excluded.updated_at`,
    bucket.key,
    bucket.window_start,
    bucket.count,
    bucket.updated_at,
  );
}

export async function consumeRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
  envOverride?: DracoEnv | null;
  store?: RateLimitStore;
}): Promise<RateLimitDecision> {
  const now = Date.now();
  const windowStart = Math.floor(now / params.windowMs) * params.windowMs;
  const resetAt = new Date(windowStart + params.windowMs).toISOString();
  const store = params.store ?? defaultStore;

  let bucket = await store.get(params.key);
  if (!bucket) {
    bucket = await getBucketFromDb({ key: params.key, envOverride: params.envOverride });
  }

  const count = bucket && bucket.window_start === windowStart ? bucket.count + 1 : 1;
  const nextBucket: RateLimitBucket = {
    key: params.key,
    window_start: windowStart,
    count,
    updated_at: new Date(now).toISOString(),
  };

  await store.set(nextBucket);
  if (getDb(params.envOverride)) {
    await setBucketInDb({ bucket: nextBucket, envOverride: params.envOverride });
  }

  const remaining = Math.max(0, params.limit - count);
  return {
    allowed: count <= params.limit,
    count,
    remaining,
    resetAt,
    limit: params.limit,
  };
}

export async function bumpAbuseCounter(params: {
  key: string;
  windowMs: number;
  threshold: number;
  envOverride?: DracoEnv | null;
  store?: RateLimitStore;
}): Promise<{ count: number; thresholdReached: boolean }> {
  const decision = await consumeRateLimit({
    key: params.key,
    limit: params.threshold,
    windowMs: params.windowMs,
    envOverride: params.envOverride,
    store: params.store,
  });
  return { count: decision.count, thresholdReached: decision.count >= params.threshold };
}

export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const cf = request.headers.get("cf-connecting-ip")?.trim();
  return forwarded || cf || "unknown";
}
