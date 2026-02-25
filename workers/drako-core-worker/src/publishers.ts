import type { DrkoCoreEnv, GovernanceEventSpecsV1, GovernanceSeverities } from "./types";

type BuildGovernanceEventInputs = {
  eventType: string;
  source: string;
  saasSlug?: string | null;
  tenantId?: string | null;
  actorType: string;
  actorId: string;
  severity?: GovernanceSeverities;
  metadata?: Record<string, unknown>;
  traceId?: string | null;
  correlationId?: string | null;
  eventId?: string | null;
  occurredAt?: string | null;
};

function readSafeIds(value: string | null | undefined): string {
  const normalizedValue = String(value ?? "").trim();
  if (normalizedValue.length >= 8) {
    return normalizedValue;
  }
  return crypto.randomUUID();
}

export function buildGovernanceEventSpecsV1(inputs: BuildGovernanceEventInputs): GovernanceEventSpecsV1 {
  return {
    event_id: (inputs.eventId && inputs.eventId.trim()) || crypto.randomUUID(),
    event_type: inputs.eventType,
    source: inputs.source,
    saas_slug: inputs.saasSlug ?? null,
    tenant_id: inputs.tenantId ?? null,
    actor_type: inputs.actorType,
    actor_id: inputs.actorId,
    severity: inputs.severity ?? "info",
    occurred_at: inputs.occurredAt ?? new Date().toISOString(),
    metadata: inputs.metadata ?? {},
    trace_id: readSafeIds(inputs.traceId),
    correlation_id: readSafeIds(inputs.correlationId),
    schema_version: "v1",
  };
}

export async function publishGlobalEvents(params: {
  env: DrkoCoreEnv;
  event: GovernanceEventSpecsV1;
}): Promise<GovernanceEventSpecsV1> {
  await params.env.DRKO_GLOBAL_EVENTS.send(params.event);
  return params.event;
}
