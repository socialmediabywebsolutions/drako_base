import {
  buildCircuitBreakerKey,
  buildMonthlyUsageKey,
  consumeAiRateLimit,
  createInMemoryAiGovernanceStore,
  getUsageCounter,
  incrementUsageCounter,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
  transitionBreakerToHalfOpen,
} from "../src/lib/orchestrator/ai-governance";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function testRateLimit() {
  const store = createInMemoryAiGovernanceStore();
  const tenantId = "tenant_demo";
  const route = "/api/orchestrator";
  const limit = 2;

  const first = await consumeAiRateLimit({
    tenantId,
    saasSlug: "demo",
    route,
    limit,
    windowMs: 60_000,
    store,
  });
  const second = await consumeAiRateLimit({
    tenantId,
    saasSlug: "demo",
    route,
    limit,
    windowMs: 60_000,
    store,
  });
  const third = await consumeAiRateLimit({
    tenantId,
    saasSlug: "demo",
    route,
    limit,
    windowMs: 60_000,
    store,
  });

  assert(first.allowed, "first request should be allowed");
  assert(second.allowed, "second request should be allowed");
  assert(!third.allowed, "third request should be blocked");
}

async function testQuotaCounters() {
  const store = createInMemoryAiGovernanceStore();
  const key = buildMonthlyUsageKey({ tenantId: "tenant_demo", saasSlug: "demo" });

  const initial = await getUsageCounter({ key, store });
  assert(initial.tokens_in === 0, "initial tokens_in should be 0");

  await incrementUsageCounter({ key, tokensIn: 120, tokensOut: 80, requests: 1, store });
  const updated = await getUsageCounter({ key, store });
  assert(updated.tokens_in === 120, "tokens_in should increase");
  assert(updated.tokens_out === 80, "tokens_out should increase");
  assert(updated.requests_count === 1, "requests_count should increase");
}

async function testCircuitBreaker() {
  const store = createInMemoryAiGovernanceStore();
  const breakerKey = buildCircuitBreakerKey({ tenantId: "tenant_demo", saasSlug: "demo", provider: "fireworks" });

  await recordCircuitBreakerFailure({
    key: breakerKey,
    threshold: 2,
    cooldownSeconds: 60,
    error: "timeout",
    store,
  });
  const second = await recordCircuitBreakerFailure({
    key: breakerKey,
    threshold: 2,
    cooldownSeconds: 60,
    error: "timeout",
    store,
  });
  assert(second.breaker.state === "OPEN", "breaker should open after threshold");

  const halfOpen = await transitionBreakerToHalfOpen({ key: breakerKey, store });
  assert(halfOpen.state === "HALF_OPEN", "breaker should move to half-open");

  await recordCircuitBreakerSuccess({ key: breakerKey, trials: 2, store });
  const closed = await recordCircuitBreakerSuccess({ key: breakerKey, trials: 2, store });
  assert(closed.state === "CLOSED", "breaker should close after trials");
}

async function main() {
  await testRateLimit();
  await testQuotaCounters();
  await testCircuitBreaker();
  console.log("Orchestrator governance fixtures: OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
