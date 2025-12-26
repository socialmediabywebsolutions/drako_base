import { queryAll, run } from "@/lib/db";

export type StripeWebhookEventStatus = "received" | "processed" | "failed";

export type StripeWebhookEventRow = {
  stripe_event_id: string;
  received_at: string;
  processed_at: string | null;
  status: StripeWebhookEventStatus;
  attempts: number;
  last_error: string | null;
  tenant_id: string | null;
  saas_slug: string | null;
  correlation_id: string;
};

export async function findStripeWebhookEvent(eventId: string): Promise<StripeWebhookEventRow | null> {
  const rows = await queryAll<StripeWebhookEventRow>(
    `SELECT stripe_event_id, received_at, processed_at, status, attempts, last_error, tenant_id, saas_slug, correlation_id
     FROM stripe_webhook_events
     WHERE stripe_event_id = ?
     LIMIT 1`,
    eventId,
  );
  return rows[0] ?? null;
}

export async function insertStripeWebhookReceived(params: {
  eventId: string;
  correlationId: string;
}): Promise<boolean> {
  const now = new Date().toISOString();
  return run(
    `INSERT INTO stripe_webhook_events (stripe_event_id, received_at, processed_at, status, attempts, last_error, tenant_id, saas_slug, correlation_id)
     VALUES (?, ?, NULL, 'received', 0, NULL, NULL, NULL, ?)`,
    params.eventId,
    now,
    params.correlationId,
  );
}

export async function updateStripeWebhookProcessed(params: {
  eventId: string;
  tenantId?: string | null;
  saasSlug?: string | null;
  attempts: number;
}): Promise<boolean> {
  const now = new Date().toISOString();
  return run(
    `UPDATE stripe_webhook_events
     SET processed_at = ?, status = 'processed', attempts = ?, tenant_id = ?, saas_slug = ?, last_error = NULL
     WHERE stripe_event_id = ?`,
    now,
    params.attempts,
    params.tenantId ?? null,
    params.saasSlug ?? null,
    params.eventId,
  );
}

export async function updateStripeWebhookFailed(params: {
  eventId: string;
  attempts: number;
  lastError: string;
  tenantId?: string | null;
  saasSlug?: string | null;
}): Promise<boolean> {
  return run(
    `UPDATE stripe_webhook_events
     SET status = 'failed', attempts = ?, last_error = ?, tenant_id = ?, saas_slug = ?
     WHERE stripe_event_id = ?`,
    params.attempts,
    params.lastError,
    params.tenantId ?? null,
    params.saasSlug ?? null,
    params.eventId,
  );
}
