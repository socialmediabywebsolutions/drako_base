import { recordCampamentoEvent } from "@/lib/empire/events";

export async function executeRetryJob(jobId: string, tenantId: string) {
  await recordCampamentoEvent({
    tenantId,
    saasId: null,
    type: "factory.recovery.retry_job.executed",
    severity: "INFO",
    source: "FACTORY_RECOVERY_EXECUTOR",
    message: `Recovery executor simulated provisioning retry for job ${jobId}.`,
    metadata: {
      jobId,
      execution: "simulated",
      operation: "retry_job",
    },
    correlationId: crypto.randomUUID(),
  });

  return {
    ok: true as const,
    success: true as const,
  };
}

export async function executeRetryDomainVerify(domain: string, tenantId: string) {
  await recordCampamentoEvent({
    tenantId,
    saasId: null,
    type: "factory.recovery.retry_domain_verify.executed",
    severity: "INFO",
    source: "FACTORY_RECOVERY_EXECUTOR",
    message: `Recovery executor simulated domain verify retry for ${domain}.`,
    metadata: {
      domain,
      execution: "simulated",
      operation: "retry_domain_verify",
    },
    correlationId: crypto.randomUUID(),
  });

  return {
    ok: true as const,
    success: true as const,
  };
}
