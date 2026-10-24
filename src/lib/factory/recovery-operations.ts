import { recordCampamentoEvent } from "@/lib/empire/events";
import { enqueueRecoveryOperation } from "@/lib/factory/recovery-queue";

export class FactoryRecoveryOperationError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 400, message?: string) {
    super(message ?? code);
    this.name = "FactoryRecoveryOperationError";
    this.code = code;
    this.status = status;
  }
}

function normalizeJobId(jobId: string): string {
  return jobId.trim();
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

function assertValidJobId(jobId: unknown): string {
  if (typeof jobId !== "string") {
    throw new FactoryRecoveryOperationError("INVALID_JOB_ID");
  }

  const normalized = normalizeJobId(jobId);
  if (!normalized || normalized.length > 200 || !/^[a-zA-Z0-9._:-]+$/.test(normalized)) {
    throw new FactoryRecoveryOperationError("INVALID_JOB_ID");
  }

  return normalized;
}

function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253 || !hostname.includes(".")) return false;
  return hostname.split(".").every((label) => {
    if (!label || label.length > 63) return false;
    if (!/^[a-z0-9-]+$/i.test(label)) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
    return true;
  });
}

function assertValidDomain(domain: unknown): string {
  if (typeof domain !== "string") {
    throw new FactoryRecoveryOperationError("INVALID_DOMAIN");
  }

  const normalized = normalizeDomain(domain);
  if (!isValidHostname(normalized)) {
    throw new FactoryRecoveryOperationError("INVALID_DOMAIN");
  }

  return normalized;
}

function resolveCorrelationId(input?: string | null): string {
  return input?.trim() || crypto.randomUUID();
}

export async function requestRetryJobOperation(params: {
  tenantId: string;
  jobId: unknown;
  correlationId?: string | null;
}) {
  const jobId = assertValidJobId(params.jobId);
  const correlationId = resolveCorrelationId(params.correlationId);

  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: null,
    type: "factory.recovery.retry_job.requested",
    severity: "INFO",
    source: "FACTORY_CONTROL_PLANE",
    message: `Manual retry requested for provisioning job ${jobId}.`,
    metadata: {
      jobId,
      operation: "retry_job",
    },
    correlationId,
  });

  await enqueueRecoveryOperation({
    tenantId: params.tenantId,
    type: "retry_job",
    jobId,
  });

  return {
    ok: true as const,
    accepted: true as const,
  };
}

export async function requestRetryDomainVerifyOperation(params: {
  tenantId: string;
  domain: unknown;
  correlationId?: string | null;
}) {
  const domain = assertValidDomain(params.domain);
  const correlationId = resolveCorrelationId(params.correlationId);

  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: null,
    type: "factory.recovery.retry_domain_verify.requested",
    severity: "INFO",
    source: "FACTORY_CONTROL_PLANE",
    message: `Manual retry requested for domain verification ${domain}.`,
    metadata: {
      domain,
      operation: "retry_domain_verify",
    },
    correlationId,
  });

  await enqueueRecoveryOperation({
    tenantId: params.tenantId,
    type: "retry_domain_verify",
    domain,
  });

  return {
    ok: true as const,
    accepted: true as const,
  };
}
