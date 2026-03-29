import { getDb } from "@/lib/db";

export type SystemEventSeverity = "info" | "warning" | "error" | "critical";

export type SystemEvent = {
  id: string;
  tenantId: string;
  eventType: string;
  severity: SystemEventSeverity;
  data: Record<string, unknown>;
  createdAt: string;
};

type SystemEventRow = {
  id: string;
  tenant_id: string;
  event_type: string;
  severity: string;
  data_json: string;
  created_at: string;
};

export class EventLogger {
  constructor(private db: D1Database = getDb()) {}

  async logEvent(input: {
    tenantId: string;
    eventType: string;
    severity: SystemEventSeverity;
    data: Record<string, unknown>;
  }): Promise<SystemEvent> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    try {
      await this.db
        .prepare(
          `INSERT INTO mentoria_system_events (
            id, tenant_id, event_type, severity, data_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(id, input.tenantId, input.eventType, input.severity, JSON.stringify(input.data), now)
        .run();
    } catch (error) {
      console.error("[EventLogger] Failed to log event:", error);
      // Don't throw - logging failure should not break the system
    }

    return {
      id,
      tenantId: input.tenantId,
      eventType: input.eventType,
      severity: input.severity,
      data: input.data,
      createdAt: now,
    };
  }

  async getEvents(input: {
    tenantId: string;
    severity?: SystemEventSeverity;
    eventType?: string;
    limit?: number;
    since?: string;
  }): Promise<SystemEvent[]> {
    let query = `SELECT * FROM mentoria_system_events WHERE tenant_id = ?`;
    const params: any[] = [input.tenantId];

    if (input.severity) {
      query += ` AND severity = ?`;
      params.push(input.severity);
    }

    if (input.eventType) {
      query += ` AND event_type = ?`;
      params.push(input.eventType);
    }

    if (input.since) {
      query += ` AND created_at >= ?`;
      params.push(input.since);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(input.limit ?? 100);

    const result = await this.db.prepare(query).bind(...params).all<SystemEventRow>();

    return (result.results ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      severity: row.severity as SystemEventSeverity,
      data: JSON.parse(row.data_json),
      createdAt: row.created_at,
    }));
  }

  async getCriticalEvents(tenantId: string, limit: number = 50): Promise<SystemEvent[]> {
    return this.getEvents({
      tenantId,
      severity: "critical",
      limit,
    });
  }

  async getErrorEvents(tenantId: string, since: string, limit: number = 100): Promise<SystemEvent[]> {
    return this.getEvents({
      tenantId,
      severity: "error",
      since,
      limit,
    });
  }

  async getEventsByType(tenantId: string, eventType: string, limit: number = 50): Promise<SystemEvent[]> {
    return this.getEvents({
      tenantId,
      eventType,
      limit,
    });
  }
}
