import { describe, it, expect, beforeEach, vi } from "vitest";

const constructVerifiedStripeEvent = vi.hoisted(() => vi.fn());
const ensureStripeWebhookDedupe = vi.hoisted(() => vi.fn());
const findStripeMappingByStripeIds = vi.hoisted(() => vi.fn());
const updateStripeWebhookProcessed = vi.hoisted(() => vi.fn());
const updateStripeWebhookFailed = vi.hoisted(() => vi.fn());
const findStripeWebhookEvent = vi.hoisted(() => vi.fn());
const insertStripeWebhookReceived = vi.hoisted(() => vi.fn());
const transitionToPastDue = vi.hoisted(() => vi.fn());
const autoPauseIfPastDueExceeded = vi.hoisted(() => vi.fn());
const resumeToActive = vi.hoisted(() => vi.fn());
const archiveSaaS = vi.hoisted(() => vi.fn());
const writeBillingAuditLog = vi.hoisted(() => vi.fn());

// Mocks
vi.mock("@/lib/stripe/client", () => ({
  getStripe: vi.fn(async () => ({ /* mocked stripe client */ })),
}));

vi.mock("@/lib/db", () => ({
  run: vi.fn(),
}));

vi.mock("@/lib/billing/billing-audit", () => ({
  writeBillingAuditLog: (...args: unknown[]) => writeBillingAuditLog(...args),
}));

vi.mock("@/lib/billing/stripe-webhook-security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing/stripe-webhook-security")>(
    "@/lib/billing/stripe-webhook-security",
  );
  return {
    ...actual,
    constructVerifiedStripeEvent,
  };
});

vi.mock("@/lib/billing/stripe-webhook-processor", () => ({
  ensureStripeWebhookDedupe,
}));

vi.mock("@/lib/billing/stripe-mapping-repository", () => ({
  findStripeMappingByStripeIds,
}));

vi.mock("@/lib/billing/stripe-webhook-repository", () => ({
  findStripeWebhookEvent,
  insertStripeWebhookReceived,
  updateStripeWebhookProcessed,
  updateStripeWebhookFailed,
}));

vi.mock("@/lib/os/lifecycle", () => ({
  transitionToPastDue,
  autoPauseIfPastDueExceeded,
  resumeToActive,
  archiveSaaS,
}));

import { POST } from "@/app/api/webhooks/stripe/route";
import { StripeWebhookAuthError } from "@/lib/billing/stripe-webhook-security";

type StripeEvent = {
  id: string;
  created: number;
  type: string;
  data: { object: any };
};

function makeRequest(body = "{}", signature = "sig") {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body,
  });
}

const mapping = { tenantId: "tenant_1", saasId: "saas_1", saasSlug: "saas-slug" };

function invoiceEvent(type: string): StripeEvent {
  return {
    id: `evt_${type}`,
    created: Date.now(),
    type,
    data: {
      object: {
        lines: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
      },
    },
  };
}

function subscriptionEvent(type: string, status: string): StripeEvent {
  return {
    id: `evt_${type}_${status}`,
    created: Date.now(),
    type,
    data: {
      object: {
        status,
        items: { data: [{ price: { id: "price_1", product: "prod_1" } }] },
      },
    },
  } as StripeEvent;
}

beforeEach(() => {
  vi.clearAllMocks();
  ensureStripeWebhookDedupe.mockResolvedValue({ status: "accepted", attempts: 1 });
  findStripeMappingByStripeIds.mockResolvedValue(mapping);
  updateStripeWebhookProcessed.mockResolvedValue(true);
  updateStripeWebhookFailed.mockResolvedValue(true);
  insertStripeWebhookReceived.mockResolvedValue(true);
  findStripeWebhookEvent.mockResolvedValue(null);
  writeBillingAuditLog.mockResolvedValue(true);
});

async function run(event: StripeEvent) {
  constructVerifiedStripeEvent.mockReturnValue(event);
  const res = await POST(makeRequest(JSON.stringify({ test: true })));
  return res;
}

function getLastAudit() {
  const call = writeBillingAuditLog.mock.calls[writeBillingAuditLog.mock.calls.length - 1];
  if (!call) return null;
  const [params] = call as [{
    eventType: string;
    severity?: string;
    outcome?: string | null;
    metadata?: any;
    correlationId: string;
    stripeEventId?: string;
  }];
  return params ?? null;
}

describe("Stripe webhook route", () => {
  it("procesa invoice.paid y reanuda a activo", async () => {
    const res = await run(invoiceEvent("invoice.paid"));
    expect(res.status).toBe(200);
    expect(resumeToActive).toHaveBeenCalledWith("saas_1", expect.any(String));
    expect(transitionToPastDue).not.toHaveBeenCalled();
    expect(archiveSaaS).not.toHaveBeenCalled();
    expect(updateStripeWebhookProcessed).toHaveBeenCalledWith({
      eventId: expect.any(String),
      attempts: 1,
      tenantId: "tenant_1",
      saasSlug: "saas-slug",
    });
    const audit = getLastAudit();
    expect(audit?.eventType).toBe("invoice.paid");
    expect(audit?.outcome).toBe("processed");
    expect(audit?.metadata?.lifecycle_action).toBe("resume_to_active");
    expect(audit?.metadata?.billing_status).toBe("active");
  });

  it("procesa invoice.payment_failed y marca past_due", async () => {
    const res = await run(invoiceEvent("invoice.payment_failed"));
    expect(res.status).toBe(200);
    expect(transitionToPastDue).toHaveBeenCalledWith("saas_1", "stripe_payment_failed", expect.any(String));
    expect(autoPauseIfPastDueExceeded).toHaveBeenCalledWith("saas_1", expect.any(Date));
    expect(resumeToActive).not.toHaveBeenCalled();
    const audit = getLastAudit();
    expect(audit?.eventType).toBe("invoice.payment_failed");
    expect(audit?.outcome).toBe("processed");
    expect(audit?.metadata?.lifecycle_action).toBe("transition_to_past_due");
    expect(audit?.metadata?.billing_status).toBe("past_due");
  });

  it("procesa subscription.updated past_due", async () => {
    const res = await run(subscriptionEvent("customer.subscription.updated", "past_due"));
    expect(res.status).toBe(200);
    expect(transitionToPastDue).toHaveBeenCalledWith("saas_1", "stripe_subscription_past_due", expect.any(String));
    expect(autoPauseIfPastDueExceeded).toHaveBeenCalledWith("saas_1", expect.any(Date));
    expect(archiveSaaS).not.toHaveBeenCalled();
    const audit = getLastAudit();
    expect(audit?.eventType).toBe("customer.subscription.updated");
    expect(audit?.outcome).toBe("processed");
    expect(audit?.metadata?.lifecycle_action).toBe("transition_to_past_due");
    expect(audit?.metadata?.billing_status).toBe("past_due");
  });

  it("procesa subscription.updated active/trialing y reanuda", async () => {
    const res = await run(subscriptionEvent("customer.subscription.updated", "active"));
    expect(res.status).toBe(200);
    expect(resumeToActive).toHaveBeenCalledWith("saas_1", expect.any(String));
    expect(transitionToPastDue).not.toHaveBeenCalled();
  });

  it("procesa subscription.updated canceled/unpaid y archiva", async () => {
    const res = await run(subscriptionEvent("customer.subscription.updated", "canceled"));
    expect(res.status).toBe(200);
    expect(archiveSaaS).toHaveBeenCalledWith("saas_1", "stripe_subscription_canceled");
  });

  it("procesa subscription.deleted y archiva", async () => {
    const res = await run(subscriptionEvent("customer.subscription.deleted", "active"));
    expect(res.status).toBe(200);
    expect(archiveSaaS).toHaveBeenCalledWith("saas_1", "stripe_subscription_deleted");
  });

  it("evento sin mapping no toca lifecycle y marca processed con tenant nulo", async () => {
    findStripeMappingByStripeIds.mockResolvedValueOnce(null);
    const res = await run(invoiceEvent("invoice.paid"));
    expect(res.status).toBe(200);
    expect(resumeToActive).not.toHaveBeenCalled();
    expect(updateStripeWebhookProcessed).toHaveBeenCalledWith({
      eventId: expect.any(String),
      attempts: 1,
      tenantId: null,
      saasSlug: null,
    });
    const audit = getLastAudit();
    expect(audit?.outcome).toBe("ignored_no_mapping");
    expect(audit?.severity).toBe("warning");
    expect(audit?.metadata?.lifecycle_action).toBe("none");
  });

  it("evento duplicado se descarta sin lifecycle", async () => {
    ensureStripeWebhookDedupe.mockResolvedValueOnce({ status: "duplicate", attempts: 1 });
    const res = await run(invoiceEvent("invoice.paid"));
    expect(res.status).toBe(200);
    expect(resumeToActive).not.toHaveBeenCalled();
    expect(updateStripeWebhookProcessed).not.toHaveBeenCalled();
    expect(updateStripeWebhookFailed).not.toHaveBeenCalled();
    const audit = getLastAudit();
    expect(audit?.outcome).toBe("duplicate");
    expect(audit?.severity).toBe("info");
    expect(audit?.metadata?.lifecycle_action).toBe("none");
  });

  it("firma inválida devuelve 400", async () => {
    constructVerifiedStripeEvent.mockImplementationOnce(() => {
      throw new StripeWebhookAuthError("bad_sig", 400);
    });
    const res = await POST(makeRequest(JSON.stringify({ test: true })));
    expect(res.status).toBe(400);
    expect(resumeToActive).not.toHaveBeenCalled();
    expect(transitionToPastDue).not.toHaveBeenCalled();
  });

  it("evento con error marca failed en audit log", async () => {
    resumeToActive.mockRejectedValueOnce(new Error("boom"));
    const res = await run(invoiceEvent("invoice.paid"));
    expect(res.status).toBe(500);
    const audit = getLastAudit();
    expect(audit?.outcome).toBe("failed");
    expect(audit?.severity).toBe("error");
    expect(audit?.metadata?.lifecycle_action).toBe("none");
  });
});
