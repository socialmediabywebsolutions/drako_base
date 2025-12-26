import { run } from "@/lib/db";

export type CampamentoEventSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

export type CampamentoEventInput = {
  tenantId: string;
  saasId?: string | null;
  type: string;
  severity: CampamentoEventSeverity;
  source: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  correlationId: string;
  createdAt?: string;
};

function generateId(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export async function recordCampamentoEvent(input: CampamentoEventInput): Promise<void> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  await run(
    `INSERT INTO campamento_events (id, tenant_id, saas_id, type, severity, source, message, metadata, correlation_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    generateId("event"),
    input.tenantId,
    input.saasId ?? null,
    input.type,
    input.severity,
    input.source,
    input.message,
    metadata,
    input.correlationId,
    createdAt,
  );
}
