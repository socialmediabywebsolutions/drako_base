import { recordCampamentoEvent } from "@/lib/empire/events";
import { triggerRecoveryCycle } from "@/lib/factory/recovery-scheduler";

const FACTORY_SCHEDULER_TENANT_ID = "system";

export async function runFactorySchedulerCycle(): Promise<void> {
  const correlationId = crypto.randomUUID();

  await recordCampamentoEvent({
    tenantId: FACTORY_SCHEDULER_TENANT_ID,
    saasId: null,
    type: "factory.scheduler.cycle.started",
    severity: "INFO",
    source: "FACTORY_SCHEDULER_WORKER",
    message: "Factory scheduler cycle started.",
    metadata: {
      subsystem: "recovery",
    },
    correlationId,
  });

  await triggerRecoveryCycle();

  await recordCampamentoEvent({
    tenantId: FACTORY_SCHEDULER_TENANT_ID,
    saasId: null,
    type: "factory.scheduler.cycle.completed",
    severity: "INFO",
    source: "FACTORY_SCHEDULER_WORKER",
    message: "Factory scheduler cycle completed.",
    metadata: {
      subsystem: "recovery",
    },
    correlationId,
  });
}
