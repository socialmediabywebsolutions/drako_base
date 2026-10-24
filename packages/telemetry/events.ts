type TelemetriesEventName = "user_registered" | "subscription_changed" | "usage_reported";

export type HoldingTelemetryPayload = {
  eventName: TelemetriesEventName;
  saasSlug: string;
  tenantId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

export function normalizeHoldingTelemetryEvent(input: Partial<HoldingTelemetryPayload>): HoldingTelemetryPayload | null {
  if (!input.eventName || !input.saasSlug || !input.tenantId) return null;
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  return {
    eventName: input.eventName,
    saasSlug: input.saasSlug,
    tenantId: input.tenantId,
    occurredAt,
    payload: input.payload ?? {},
  };
}

export function toAnonymizedTelemetryPayload(event: HoldingTelemetryPayload): HoldingTelemetryPayload {
  const cloned = { ...event, payload: { ...event.payload } };
  delete (cloned.payload as Record<string, unknown>).email;
  delete (cloned.payload as Record<string, unknown>).sessionToken;
  delete (cloned.payload as Record<string, unknown>).cookie;
  return cloned;
}
