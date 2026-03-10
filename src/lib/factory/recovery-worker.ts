import { recordCampamentoEvent } from "@/lib/empire/events";
import { executeRetryDomainVerify, executeRetryJob } from "@/lib/factory/recovery-executors";
import {
  listPendingRecoveryOperations,
  markRecoveryOperationCompleted,
  type FactoryRecoveryOperation,
} from "@/lib/factory/recovery-queue";

function buildExecutionMessage(operation: FactoryRecoveryOperation): string {
  if (operation.type === "retry_job") {
    return `Recovery worker accepted retry for job ${operation.jobId ?? "unknown"}.`;
  }

  return `Recovery worker accepted retry for domain ${operation.domain ?? "unknown"}.`;
}

function buildEventType(operation: FactoryRecoveryOperation): string {
  if (operation.type === "retry_job") {
    return "factory.recovery.retry_job.completed";
  }

  return "factory.recovery.retry_domain_verify.completed";
}

function buildMetadata(operation: FactoryRecoveryOperation): Record<string, unknown> {
  return {
    operationId: operation.id,
    type: operation.type,
    jobId: operation.jobId ?? null,
    domain: operation.domain ?? null,
    status: "completed",
  };
}

export async function processPendingRecoveryOperations(): Promise<void> {
  const operations = await listPendingRecoveryOperations();

  for (const operation of operations) {
    if (operation.type === "retry_job" && operation.jobId) {
      await executeRetryJob(operation.jobId, operation.tenantId);
    }

    if (operation.type === "retry_domain_verify" && operation.domain) {
      await executeRetryDomainVerify(operation.domain, operation.tenantId);
    }

    await recordCampamentoEvent({
      tenantId: operation.tenantId,
      saasId: null,
      type: buildEventType(operation),
      severity: "INFO",
      source: "FACTORY_RECOVERY_WORKER",
      message: buildExecutionMessage(operation),
      metadata: buildMetadata(operation),
      correlationId: operation.id,
    });

    await markRecoveryOperationCompleted(operation.id);
  }
}
