import type { UserContext } from "@/lib/drako/memory";
import { getDb } from "@/lib/db";

export type MetricEvent = {
  id: string;
  tenantId: string;
  userId: string;
  type: string;
  name: string;
  source: string;
  value?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DrakoEventRecord = {
  id: string;
  userId: string;
  type: string;
  payload: ActivationEventPayload;
  createdAt: string;
};

type ActivationEventPayload = Record<string, unknown>;

export function createMetricEvent(input: {
    id?: string;
    context: UserContext;
    type?: string;
    name: string;
  source: string;
  value?: number;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): MetricEvent {
  return {
    id: input.id ?? crypto.randomUUID(),
    tenantId: input.context.tenantId,
    userId: input.context.userId,
    type: input.type ?? input.name,
    name: input.name,
    source: input.source,
    value: input.value,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

type EventRow = {
  id: string;
  user_id: string;
  type: string;
  payload_json: string;
  created_at: string;
};

export async function trackEvent(
  event: import("@/lib/drako/activation").ActivationEvent | MetricEvent,
  db: D1Database = getDb(),
): Promise<void> {
  const payload = JSON.stringify(event);
  await db
    .prepare(`INSERT INTO drako_events (id, user_id, type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(event.id, event.userId, event.type, payload, event.createdAt)
    .run();
}

function parseEventRow(row: EventRow): DrakoEventRecord {
  let payload: ActivationEventPayload;
  try {
    payload = JSON.parse(row.payload_json) as ActivationEventPayload;
  } catch (error) {
    throw new Error(`DRAKO_EVENT_INVALID_JSON:${row.id}:${error instanceof Error ? error.message : String(error)}`);
  }
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    payload,
    createdAt: row.created_at,
  };
}

export async function listEventsForUser(userId: string, limit = 50, db: D1Database = getDb()): Promise<DrakoEventRecord[]> {
  const result = await db
    .prepare(`SELECT id, user_id, type, payload_json, created_at FROM drako_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
    .bind(userId, limit)
    .all<EventRow>();
  return (result.results ?? []).map(parseEventRow);
}
