import { recordCampamentoEvent } from "@/lib/empire/events";
import { runFactoryCronCycle } from "@/lib/factory/factory-cron-trigger";

const FACTORY_HEALTH_TENANT_ID = "system";

export async function runFactoryHealthLoop(): Promise<void> {
  const correlationId = crypto.randomUUID();
  const outcome = "stable";

  await recordCampamentoEvent({
    tenantId: FACTORY_HEALTH_TENANT_ID,
    saasId: null,
    type: "factory.health.cycle.started",
    severity: "INFO",
    source: "FACTORY_HEALTH_LOOP",
    message: "Factory health cycle started.",
    metadata: {
      subsystem: "factory",
      stage: "post-recovery",
    },
    correlationId,
  });

  await runFactoryCronCycle();

  await recordCampamentoEvent({
    tenantId: FACTORY_HEALTH_TENANT_ID,
    saasId: null,
    type: "factory.health.cycle.completed",
    severity: "INFO",
    source: "FACTORY_HEALTH_LOOP",
    message: "Factory health cycle completed.",
    metadata: {
      subsystem: "factory",
      stage: "post-recovery",
      outcome,
    },
    correlationId,
  });
}
