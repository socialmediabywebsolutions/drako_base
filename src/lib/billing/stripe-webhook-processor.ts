import type { StripeWebhookEventRow } from "@/lib/billing/stripe-webhook-repository";

export type StripeWebhookDedupeStore = {
  findEvent: (eventId: string) => Promise<StripeWebhookEventRow | null>;
  insertReceived: (params: { eventId: string; correlationId: string }) => Promise<boolean>;
  markProcessed: (params: {
    eventId: string;
    attempts: number;
    tenantId?: string | null;
    saasSlug?: string | null;
  }) => Promise<boolean>;
  markFailed: (params: {
    eventId: string;
    attempts: number;
    lastError: string;
    tenantId?: string | null;
    saasSlug?: string | null;
  }) => Promise<boolean>;
};

export type StripeWebhookDedupeResult =
  | { status: "duplicate"; attempts: number }
  | { status: "accepted"; attempts: number };

export async function ensureStripeWebhookDedupe(params: {
  store: StripeWebhookDedupeStore;
  eventId: string;
  correlationId: string;
}): Promise<StripeWebhookDedupeResult> {
  const existing = await params.store.findEvent(params.eventId);
  if (existing) {
    return { status: "duplicate", attempts: existing.attempts };
  }
  const inserted = await params.store.insertReceived({ eventId: params.eventId, correlationId: params.correlationId });
  if (!inserted) {
    const recheck = await params.store.findEvent(params.eventId);
    if (recheck) {
      return { status: "duplicate", attempts: recheck.attempts };
    }
  }
  return { status: "accepted", attempts: 1 };
}
