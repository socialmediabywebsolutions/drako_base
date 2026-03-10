import { recordCampamentoEvent } from "@/lib/empire/events";
import { processPendingRecoveryOperations } from "@/lib/factory/recovery-worker";

const RECOVERY_RUNNER_TENANT_ID = "system";

export async function runScheduledRecoveryCycle(): Promise<void> {
  const correlationId = crypto.randomUUID();

  await recordCampamentoEvent({
    tenantId: RECOVERY_RUNNER_TENANT_ID,
    saasId: null,
    type: "factory.recovery.cycle.started",
    severity: "INFO",
    source: "FACTORY_RECOVERY_RUNNER",
    message: "Scheduled factory recovery cycle started.",
    metadata: null,
    correlationId,
  });

  const processedOperationsCount = await processPendingRecoveryOperations();

  await recordCampamentoEvent({
    tenantId: RECOVERY_RUNNER_TENANT_ID,
    saasId: null,
    type: "factory.recovery.cycle.completed",
    severity: "INFO",
    source: "FACTORY_RECOVERY_RUNNER",
    message: "Scheduled factory recovery cycle completed.",
    metadata: {
      processedOperationsCount,
    },
    correlationId,
  });
}
