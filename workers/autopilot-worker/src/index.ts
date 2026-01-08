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

const RATE_LIMIT_CAPACITY = 40;
const RATE_LIMIT_INTERVAL_MS = 60_000;
const CIRCUIT_FAILURE_THRESHOLD = 10;
const CIRCUIT_RESET_MS = 300_000;

type ScheduledHandler = (controller: ScheduledController, env: AutopilotEnv, ctx: ExecutionContext) => Promise<void>;

export interface AutopilotEnv {
  DRACO_DB: D1Database;
  AUTOPILOT_QUEUE?: Queue;
  AUTOPILOT_DLQ?: Queue;
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

class CircuitBreaker {
  private openedAt: number | null = null;
  private failureCount = 0;

  recordSuccess() {
    this.failureCount = 0;
    this.openedAt = null;
  }

  recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
      this.openedAt = Date.now();
    }
  }

  isOpen(): boolean {
    if (this.openedAt == null) return false;
    const elapsed = Date.now() - this.openedAt;
    if (elapsed >= CIRCUIT_RESET_MS) {
      this.failureCount = 0;
      this.openedAt = null;
      return false;
    }
    return true;
  }
}

function isPollMessage(message: HostnameQueueMessage): message is HostnamePollPayload {
  return message.type === "domains.hostname.poll";
}

const rateLimiter = new RateLimiter(RATE_LIMIT_CAPACITY, RATE_LIMIT_INTERVAL_MS);
const circuitBreaker = new CircuitBreaker();

async function handleQueueMessage(message: Message<unknown>, env: AutopilotEnv): Promise<void> {
  const correlationId = generateCorrelationId();

  if (circuitBreaker.isOpen()) {
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

  if (!rateLimiter.take()) {
    circuitBreaker.recordFailure();
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
    circuitBreaker.recordFailure();
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

  const repo = createDomainsRepository(env.DRACO_DB);
  const recordEvent = createCampamentoEventsRecorder(env.DRACO_DB);

  try {
    const result = await processHostnameMessage(payload, { repo, recordEvent });
    circuitBreaker.recordSuccess();

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

    await message.ack();
  } catch (error) {
    circuitBreaker.recordFailure();
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
    if (!circuitBreaker.isOpen()) return;

    circuitBreaker.recordSuccess();
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
} satisfies ExportedHandler<AutopilotEnv>;
