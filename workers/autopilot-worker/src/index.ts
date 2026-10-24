/// <reference types="@cloudflare/workers-types" />

import type {
  CampamentoEventInput,
  HostnamePollPayload,
  HostnameQueueMessage,
} from "./hostnames";
import {
  createCampamentoEventsRecorder,
  createDomainsRepository,
  generateCorrelationId,
  processHostnameMessage,
} from "./hostnames";
import { handleScheduledReset } from "./cron";
import { handleAuthRequest } from "./api/auth";

const RATE_LIMIT_CAPACITY = 40;
const RATE_LIMIT_INTERVAL_MS = 60_000;
const CIRCUIT_FAILURE_THRESHOLD = 10;
const CIRCUIT_RESET_MS = 300_000;

type ScheduledHandler = (controller: ScheduledController, env: AutopilotEnv, ctx: ExecutionContext) => Promise<void>;

export interface AutopilotEnv {
  DRACO_DB: D1Database;
  AI: any;
  AUTOPILOT_QUEUE?: Queue;
  AUTOPILOT_DLQ?: Queue;
  VERCEL_TO_WORKER_SECRET: string;
  X_DRAKO_ORIGIN_SECRET: string;
  ALERT_WEBHOOK_URL?: string;
}

class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(private capacity: number, private intervalMs: number) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  take(): boolean {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= this.intervalMs) {
      const refillTokens = Math.floor(elapsed / this.intervalMs) * this.capacity;
      this.tokens = Math.min(this.capacity, this.tokens + refillTokens);
      this.lastRefill = now;
    }
    if (this.tokens <= 0) return false;
    this.tokens -= 1;
    return true;
  }
}


function isPollMessage(message: HostnameQueueMessage): message is HostnamePollPayload {
  return message.type === "domains.hostname.poll";
}

const rateLimiter = new RateLimiter(RATE_LIMIT_CAPACITY, RATE_LIMIT_INTERVAL_MS);

// Steel v1.0.1 - Persistent Circuit Breaker
async function getBreakerStatus(db: D1Database, key: string): Promise<{ state: string; opened_at: string | null }> {
  const stmt = db.prepare("SELECT state, opened_at FROM ai_circuit_breakers WHERE key = ? LIMIT 1");
  const result = await stmt.bind(key).all<{ state: string; opened_at: string | null }>();
  return result.results?.[0] || { state: "CLOSED", opened_at: null };
}

async function updateBreakerState(db: D1Database, key: string, next: string, reason: string, correlationId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db.prepare("INSERT INTO ai_circuit_breakers (key, state, failure_count, opened_at, updated_at) VALUES (?, ?, 0, ?, ?) ON CONFLICT(key) DO UPDATE SET state = excluded.state, failure_count = 0, opened_at = excluded.opened_at, updated_at = excluded.updated_at").bind(key, next, next === "OPEN" ? now : null, now),
    db.prepare("INSERT INTO ai_breaker_logs (id, breaker_key, previous_state, new_state, reason, correlation_id, created_at) VALUES (?, ?, '?', ?, ?, ?, ?)").bind(`log_${Date.now()}`, key, next === "OPEN" ? "CLOSED" : "OPEN", next, reason, correlationId, now)
  ]);
}

async function recordFailure(db: D1Database, key: string, threshold: number): Promise<void> {
  const now = new Date().toISOString();
  const rows = await db.prepare("SELECT state, failure_count FROM ai_circuit_breakers WHERE key = ?").bind(key).all<{ state: string, failure_count: number }>();
  const current = rows.results?.[0] || { state: "CLOSED", failure_count: 0 };
  const nextCount = current.failure_count + 1;

  if (nextCount >= threshold && current.state !== "OPEN") {
    await db.batch([
      db.prepare("UPDATE ai_circuit_breakers SET state = 'OPEN', opened_at = ?, failure_count = ?, updated_at = ? WHERE key = ?").bind(now, nextCount, now, key),
      db.prepare("INSERT INTO ai_breaker_logs (id, breaker_key, previous_state, new_state, reason, created_at) VALUES (?, ?, ?, 'OPEN', 'THRESHOLD_REACHED', ?)").bind(`log_${Date.now()}`, key, current.state, now)
    ]);
  } else {
    await db.prepare("INSERT INTO ai_circuit_breakers (key, state, failure_count, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET failure_count = excluded.failure_count, updated_at = excluded.updated_at").bind(key, current.state, nextCount, now);
  }
}

async function recordSuccess(db: D1Database, key: string): Promise<void> {
  await db.prepare("UPDATE ai_circuit_breakers SET failure_count = 0, state = 'CLOSED', opened_at = NULL, updated_at = ? WHERE key = ?").bind(new Date().toISOString(), key).run();
}

async function checkIdempotency(db: D1Database, key: string): Promise<boolean> {
  const stmt = db.prepare("SELECT idempotency_key FROM processed_jobs WHERE idempotency_key = ? LIMIT 1");
  const result = await stmt.bind(key).all();
  return (result.results?.length ?? 0) > 0;
}

async function markJobProcessed(db: D1Database, key: string, status: string, correlationId: string): Promise<void> {
  const stmt = db.prepare("INSERT INTO processed_jobs (idempotency_key, status, correlation_id, created_at, processed_at) VALUES (?, ?, ?, ?, ?)");
  const now = new Date().toISOString();
  await stmt.bind(key, status, correlationId, now, now).run();
}

async function handleQueueMessage(message: Message<unknown>, env: AutopilotEnv): Promise<void> {
  const correlationId = generateCorrelationId();
  const breakerKey = "autopilot:processor";

  const breaker = await getBreakerStatus(env.DRACO_DB, breakerKey);
  if (breaker.state === "OPEN") {
    const openedAt = breaker.opened_at ? new Date(breaker.opened_at).getTime() : 0;
    if (Date.now() - openedAt < CIRCUIT_RESET_MS) {
      await emitEvent(env, {
        tenantId: "system",
        saasId: null,
        type: "domains.hostname.circuit_open",
        severity: "WARNING",
        source: "AUTOPILOT_WORKER",
        message: "Circuit breaker open, skipping message",
        metadata: { messageId: message.id },
        correlationId,
      });
      await message.retry();
      return;
    }
    await updateBreakerState(env.DRACO_DB, breakerKey, "HALF_OPEN", "COOLDOWN_EXPIRED", correlationId);
  }

  if (!rateLimiter.take()) {
    await recordFailure(env.DRACO_DB, breakerKey, CIRCUIT_FAILURE_THRESHOLD);
    await emitEvent(env, {
      tenantId: "system",
      saasId: null,
      type: "domains.hostname.rate_limited",
      severity: "WARNING",
      source: "AUTOPILOT_WORKER",
      message: "Rate limit exceeded, requeuing message",
      metadata: { messageId: message.id },
      correlationId,
    });
    await message.retry();
    return;
  }

  let payload: HostnameQueueMessage | null = null;
  try {
    payload = (typeof message.body === "string" ? JSON.parse(message.body) : message.body) as HostnameQueueMessage;
    if (!payload || typeof payload !== "object" || typeof (payload as HostnameQueueMessage).type !== "string") {
      throw new Error("INVALID_PAYLOAD");
    }
  } catch (error) {
    await recordFailure(env.DRACO_DB, breakerKey, CIRCUIT_FAILURE_THRESHOLD);
    await emitEvent(env, {
      tenantId: "system",
      saasId: null,
      type: "domains.hostname.failed",
      severity: "ERROR",
      source: "AUTOPILOT_WORKER",
      message: "Failed to parse hostname message",
      metadata: { messageId: message.id, error: String(error) },
      correlationId,
    });
    await message.ack();
    return;
  }

  // Steel v1.0.1 - Idempotency Enforcement
  if (payload.idempotencyKey) {
    const isDuplicate = await checkIdempotency(env.DRACO_DB, payload.idempotencyKey);
    if (isDuplicate) {
      await emitEvent(env, {
        tenantId: payload.tenantId || "system",
        saasId: payload.saasId,
        type: "queue.job.duplicate_skipped",
        severity: "INFO",
        source: "AUTOPILOT_WORKER",
        message: `Skipping duplicate job with key ${payload.idempotencyKey}`,
        correlationId: payload.correlationId || correlationId,
      });
      await message.ack();
      return;
    }
  }

  const repo = createDomainsRepository(env.DRACO_DB);
  const recordEvent = createCampamentoEventsRecorder(env.DRACO_DB);

  try {
    const result = await processHostnameMessage(payload, { repo, recordEvent });
    await recordSuccess(env.DRACO_DB, breakerKey);

    if (result.outcome === "pending" && isPollMessage(payload)) {
      await emitEvent(env, {
        tenantId: payload.tenantId,
        saasId: payload.saasId,
        type: "queue.job.rescheduled",
        severity: "INFO",
        source: "AUTOPILOT_WORKER",
        message: `Requeue hostname poll for ${payload.domain}`,
        metadata: {
          domainId: payload.domainId,
          delaySeconds: result.nextRetrySeconds,
        },
        correlationId: result.correlationId,
      });

      if (env.AUTOPILOT_QUEUE) {
        await env.AUTOPILOT_QUEUE.send(
          {
            ...payload,
            attempt: (payload.attempt ?? 0) + 1,
            correlationId: result.correlationId,
          },
          { delaySeconds: result.nextRetrySeconds },
        );
      }
    }


    if (payload.idempotencyKey) {
      await markJobProcessed(env.DRACO_DB, payload.idempotencyKey, "COMPLETED", payload.correlationId || correlationId);
    }

    await message.ack();
  } catch (error) {
    await recordFailure(env.DRACO_DB, breakerKey, CIRCUIT_FAILURE_THRESHOLD);
    await emitEvent(env, {
      tenantId: payload.tenantId,
      saasId: payload.saasId,
      type: "domains.hostname.failed",
      severity: "ERROR",
      source: "AUTOPILOT_WORKER",
      message: `Error processing hostname ${payload.domain}`,
      metadata: { error: String(error) },
      correlationId: payload.correlationId ?? correlationId,
    });

    if (isPollMessage(payload) && payload.attempt && payload.attempt >= 8) {
      if (env.AUTOPILOT_DLQ) {
        await env.AUTOPILOT_DLQ.send(payload);
      }
      await message.ack();
      return;
    }

    await message.retry();
  }
}

async function emitEvent(env: AutopilotEnv, input: CampamentoEventInput) {
  const recorder = createCampamentoEventsRecorder(env.DRACO_DB);
  await recorder(input);
}

export default {
  async queue(batch: MessageBatch<unknown>, env: AutopilotEnv): Promise<void> {
    for (const message of batch.messages) {
      await handleQueueMessage(message, env);
    }
  },

  async scheduled(controller: ScheduledController, env: AutopilotEnv, ctx: ExecutionContext): Promise<void> {
    // 1. Monthly Cost Reset (Idempotent)
    ctx.waitUntil(handleScheduledReset(env));

    // 2. Circuit Breaker Maintenance
    const breakerKey = "autopilot:processor";
    const breaker = await getBreakerStatus(env.DRACO_DB, breakerKey);
    if (breaker.state !== "OPEN") return;

    await recordSuccess(env.DRACO_DB, breakerKey);
    await emitEvent(env, {
      tenantId: "system",
      saasId: null,
      type: "domains.hostname.circuit_half_open",
      severity: "INFO",
      source: "AUTOPILOT_WORKER",
      message: "Circuit breaker reset via scheduled event",
      metadata: { scheduledTime: controller.scheduledTime },
      correlationId: generateCorrelationId(),
    });
    ctx.waitUntil(Promise.resolve());
  },

  async fetch(request: Request, env: AutopilotEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/internal/auth")) {
      return handleAuthRequest(request, env);
    }
    if (url.pathname.startsWith("/internal/ai/run")) {
      const { handleAiRunRequest } = await import("./api/ai");
      return handleAiRunRequest(request, env, ctx);
    }
    return new Response("Not found", { status: 404 });
  }
} satisfies ExportedHandler<AutopilotEnv>;
