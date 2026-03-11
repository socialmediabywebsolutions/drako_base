import { recordCampamentoEvent } from "@/lib/empire/events";

const FACTORY_INCIDENT_TENANT_ID = "system";

export async function recordFactoryIncidentIfNeeded(outcome: string): Promise<void> {
  if (outcome === "stable") {
    return;
  }

  await recordCampamentoEvent({
    tenantId: FACTORY_INCIDENT_TENANT_ID,
    saasId: null,
    type: "factory.incident.detected",
    severity: "WARNING",
    source: "FACTORY_INCIDENT_INTELLIGENCE",
    message: "Factory incident detected after health loop.",
    metadata: {
      subsystem: "factory",
      outcome,
    },
    correlationId: crypto.randomUUID(),
  });
}
