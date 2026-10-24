import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setGlobalEnv: vi.fn(),
  queryOne: vi.fn(),
  provisionTenantFromStripe: vi.fn(),
  updateCanonicalSubscriptionLifecycleState: vi.fn(),
  writeBillingAuditLog: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  setGlobalEnv: mocks.setGlobalEnv,
}));

vi.mock("@/lib/db", () => ({
  queryOne: mocks.queryOne,
}));

vi.mock("@/lib/billing/provisioning_workflow", () => ({
  provisionTenantFromStripe: mocks.provisionTenantFromStripe,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  updateCanonicalSubscriptionLifecycleState: mocks.updateCanonicalSubscriptionLifecycleState,
}));

vi.mock("@/lib/billing/billing-audit", () => ({
  writeBillingAuditLog: mocks.writeBillingAuditLog,
}));

import worker from "@/workers/billing-consumer";

describe("billing queue worker canonical lifecycle updater", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryOne.mockResolvedValue(null);
    mocks.provisionTenantFromStripe.mockResolvedValue({ success: true, tenantId: "tenant_alpha" });
    mocks.updateCanonicalSubscriptionLifecycleState.mockResolvedValue(undefined);
    mocks.writeBillingAuditLog.mockResolvedValue(undefined);
  });

  it("routes lifecycle events through the canonical partial updater", async () => {
    const message = {
      id: "msg_1",
      body: {
        eventId: "evt_1",
        type: "invoice.payment_failed",
        data: {
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          stripePriceId: "price_1",
          customerEmail: "owner@example.com",
          saasSlug: "socialflow",
          currentPeriodEnd: "2026-05-01T00:00:00.000Z",
          cancelAtPeriodEnd: false,
        },
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await worker.queue(
      { messages: [message] } as unknown as MessageBatch<any>,
      { BILLING_QUEUE: { send: vi.fn() } } as any,
    );

    expect(mocks.updateCanonicalSubscriptionLifecycleState).toHaveBeenCalledWith({
      stripeSubscriptionId: "sub_1",
      saasSlug: "socialflow",
      status: "past_due",
      currentPeriodEnd: "2026-05-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
    });
    expect(mocks.writeBillingAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "billing_status_change",
        stripeEventId: "evt_1",
      }),
    );
    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("keeps checkout completion on the provisioning workflow path", async () => {
    const message = {
      id: "msg_2",
      body: {
        eventId: "evt_checkout",
        type: "checkout.session.completed",
        data: {
          stripeCustomerId: "cus_2",
          stripeSubscriptionId: "sub_2",
          stripePriceId: "price_2",
          customerEmail: "owner@example.com",
          saasSlug: "drako",
        },
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await worker.queue(
      { messages: [message] } as unknown as MessageBatch<any>,
      { BILLING_QUEUE: { send: vi.fn() } } as any,
    );

    expect(mocks.provisionTenantFromStripe).toHaveBeenCalledWith(message.body);
    expect(mocks.updateCanonicalSubscriptionLifecycleState).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(message.retry).not.toHaveBeenCalled();
  });

  it("skips duplicate stripe events by audit log idempotency", async () => {
    const message = {
      id: "msg_3",
      body: {
        eventId: "evt_dup",
        type: "invoice.payment_succeeded",
        data: {
          stripeCustomerId: "cus_3",
          stripeSubscriptionId: "sub_3",
          stripePriceId: "price_3",
          customerEmail: "owner@example.com",
          saasSlug: "mentoria",
        },
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    mocks.queryOne.mockResolvedValue({ id: "audit_evt_dup" });

    await worker.queue(
      { messages: [message] } as unknown as MessageBatch<any>,
      { BILLING_QUEUE: { send: vi.fn() } } as any,
    );

    expect(mocks.provisionTenantFromStripe).not.toHaveBeenCalled();
    expect(mocks.updateCanonicalSubscriptionLifecycleState).not.toHaveBeenCalled();
    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(message.retry).not.toHaveBeenCalled();
  });
});
