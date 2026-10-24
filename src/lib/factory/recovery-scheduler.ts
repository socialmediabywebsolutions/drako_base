import { recordCampamentoEvent } from "@/lib/empire/events";
import { runScheduledRecoveryCycle } from "@/lib/factory/recovery-runner";

const RECOVERY_SCHEDULER_TENANT_ID = "system";

export async function triggerRecoveryCycle(): Promise<void> {
  await recordCampamentoEvent({
    tenantId: RECOVERY_SCHEDULER_TENANT_ID,
    saasId: null,
    type: "factory.recovery.scheduler.triggered",
    severity: "INFO",
    source: "FACTORY_RECOVERY_SCHEDULER",
    message: "Factory recovery cycle triggered.",
    metadata: {
      trigger: "manual",
    },
    correlationId: crypto.randomUUID(),
  });

  await runScheduledRecoveryCycle();
}
