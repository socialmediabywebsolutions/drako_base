import Stripe from "stripe";
import { ensureStripeWebhookDedupe, type StripeWebhookDedupeStore } from "@/lib/billing/stripe-webhook-processor";
import { deriveStripeWebhookAnomalies } from "@/lib/billing/stripe-webhook-anomalies";
import { resolveWebhookAttribution } from "@/lib/billing/stripe-webhook-attribution";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function createMemoryDedupeStore(): StripeWebhookDedupeStore {
  const store = new Map<string, { attempts: number; status: string }>();
  return {
    async findEvent(eventId) {
      const entry = store.get(eventId);
      if (!entry) return null;
      return {
        stripe_event_id: eventId,
        received_at: new Date().toISOString(),
        processed_at: null,
        status: entry.status as "received" | "processed" | "failed",
        attempts: entry.attempts,
        last_error: null,
        tenant_id: null,
        saas_slug: null,
        correlation_id: eventId,
      };
    },
    async insertReceived({ eventId }) {
      if (store.has(eventId)) return false;
      store.set(eventId, { attempts: 0, status: "received" });
      return true;
    },
    async markProcessed({ eventId, attempts }) {
      store.set(eventId, { attempts, status: "processed" });
      return true;
    },
    async markFailed({ eventId, attempts }) {
      store.set(eventId, { attempts, status: "failed" });
      return true;
    },
  };
}

async function testDedupe() {
  const store = createMemoryDedupeStore();
  const first = await ensureStripeWebhookDedupe({
    store,
    eventId: "evt_test",
    correlationId: "evt_test",
  });
  const second = await ensureStripeWebhookDedupe({
    store,
    eventId: "evt_test",
    correlationId: "evt_test",
  });
  assert(first.status === "accepted", "Expected first event to be accepted");
  assert(second.status === "duplicate", "Expected duplicate event to be ignored");
}

function testInvalidSignature() {
  const stripe = new Stripe("sk_test_dummy", {});
  const payload = JSON.stringify({ id: "evt_sig", type: "invoice.paid", data: { object: { object: "invoice" } } });
  const secret = "whsec_test";
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert(typeof header === "string", "Expected test header string");
  let threw = false;
  try {
    stripe.webhooks.constructEvent(payload, "invalid_signature", secret);
  } catch {
    threw = true;
  }
  assert(threw, "Expected invalid signature to throw");
}

async function testAttributionMissing() {
  const event = {
    id: "evt_missing",
    type: "invoice.paid",
    data: { object: { object: "invoice", metadata: {} } },
  } as unknown as Stripe.Event;
  const attribution = await resolveWebhookAttribution(event, async () => null);
  const anomalies = deriveStripeWebhookAnomalies(attribution);
  assert(anomalies.some((item) => item.kind === "ATTRIBUTION_MISSING"), "Expected missing attribution anomaly");
}

async function testMappingDrift() {
  const event = {
    id: "evt_drift",
    type: "invoice.paid",
    data: {
      object: {
        object: "invoice",
        metadata: {},
        lines: { data: [{ price: { id: "price_123", product: "prod_123" } }] },
      },
    },
  } as unknown as Stripe.Event;
  const attribution = await resolveWebhookAttribution(event, async () => null);
  const anomalies = deriveStripeWebhookAnomalies(attribution);
  assert(anomalies.some((item) => item.kind === "MAPPING_DRIFT"), "Expected mapping drift anomaly");
}

async function run() {
  await testDedupe();
  testInvalidSignature();
  await testAttributionMissing();
  await testMappingDrift();
  console.log("stripe-webhook fixtures OK");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
