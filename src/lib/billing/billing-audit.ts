import { run } from "@/lib/db";

export type BillingAuditSeverity = "info" | "warning" | "error";

export type BillingAuditParams = {
  id?: string;
  saasSlug?: string | null;
  tenantId?: string | null;
  eventType: string;
  severity?: BillingAuditSeverity;
  correlationId: string;
  metadata?: Record<string, unknown> | null;
  outcome?: string | null;
  stripeEventId?: string | null;
};

function buildAuditId(params: BillingAuditParams) {
  if (params.id) return params.id;
  const suffix = params.stripeEventId ?? params.correlationId;
  return `audit_${params.eventType}_${suffix}`;
}

export async function writeBillingAuditLog(params: BillingAuditParams) {
  const mergedMetadata = {
    outcome: params.outcome ?? null,
    ...(params.metadata ?? {}),
  };
  const metadataJson = JSON.stringify(mergedMetadata);
  const id = buildAuditId(params);
  const severity: BillingAuditSeverity = params.severity ?? "info";
  await run(
    `INSERT INTO billing_audit_logs (id, saas_slug, tenant_id, event_type, severity, correlation_id, metadata_json, stripe_event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    params.saasSlug ?? null,
    params.tenantId ?? null,
    params.eventType,
    severity,
    params.correlationId,
    metadataJson,
    params.stripeEventId ?? null,
  );
}
