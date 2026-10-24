import { describe, expect, it, vi } from "vitest";
import { ensureStripeWebhookDedupe } from "@/lib/billing/stripe-webhook-processor";

describe("ensureStripeWebhookDedupe", () => {
  it("accepts new events on first receive", async () => {
    const store = {
      findEvent: vi.fn().mockResolvedValue(null),
      insertReceived: vi.fn().mockResolvedValue(true),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    };

    const result = await ensureStripeWebhookDedupe({
      store,
      eventId: "evt_new",
      correlationId: "evt_new",
    });

    expect(result).toEqual({ status: "accepted", attempts: 1 });
  });

  it("flags duplicates when event already exists", async () => {
    const store = {
      findEvent: vi.fn().mockResolvedValue({
        stripe_event_id: "evt_dup",
        received_at: new Date().toISOString(),
        processed_at: null,
        status: "received",
        attempts: 3,
        last_error: null,
        tenant_id: null,
        saas_slug: null,
        correlation_id: "evt_dup",
      }),
      insertReceived: vi.fn(),
      markProcessed: vi.fn(),
      markFailed: vi.fn(),
    };

    const result = await ensureStripeWebhookDedupe({
      store,
      eventId: "evt_dup",
      correlationId: "evt_dup",
    });

    expect(result).toEqual({ status: "duplicate", attempts: 3 });
  });
});
