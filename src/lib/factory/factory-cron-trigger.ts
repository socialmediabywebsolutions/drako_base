import { recordCampamentoEvent } from "@/lib/empire/events";
import { runFactorySchedulerCycle } from "@/lib/factory/factory-scheduler-worker";

const FACTORY_CRON_TENANT_ID = "system";

export async function runFactoryCronCycle(): Promise<void> {
  const correlationId = crypto.randomUUID();

  await recordCampamentoEvent({
    tenantId: FACTORY_CRON_TENANT_ID,
    saasId: null,
    type: "factory.cron.cycle.started",
    severity: "INFO",
    source: "FACTORY_CRON_TRIGGER",
    message: "Factory cron cycle started.",
    metadata: {
      subsystem: "scheduler",
    },
    correlationId,
  });

  await runFactorySchedulerCycle();

  await recordCampamentoEvent({
    tenantId: FACTORY_CRON_TENANT_ID,
    saasId: null,
    type: "factory.cron.cycle.completed",
    severity: "INFO",
    source: "FACTORY_CRON_TRIGGER",
    message: "Factory cron cycle completed.",
    metadata: {
      subsystem: "scheduler",
    },
    correlationId,
  });
}
