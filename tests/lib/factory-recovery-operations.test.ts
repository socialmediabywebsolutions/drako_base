import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();
  const enqueueRecoveryOperation = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  vi.doMock("@/lib/factory/recovery-queue", () => ({
    enqueueRecoveryOperation,
  }));

  const mod = await import("@/lib/factory/recovery-operations");

  return {
    ...mod,
    recordCampamentoEvent,
    enqueueRecoveryOperation,
  };
}

describe("factory recovery operations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("accepts retry-job requests and records an audit event", async () => {
    const { requestRetryJobOperation, recordCampamentoEvent, enqueueRecoveryOperation } = await loadSubject();
    recordCampamentoEvent.mockResolvedValue(undefined);
    enqueueRecoveryOperation.mockResolvedValue({ id: "op_job_1", status: "pending" });

    const result = await requestRetryJobOperation({
      tenantId: "tenant_owner",
      jobId: "job_123",
      correlationId: "corr_job_retry",
    });

    expect(result).toEqual({
      ok: true,
      accepted: true,
    });
    expect(recordCampamentoEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_owner",
      type: "factory.recovery.retry_job.requested",
      source: "FACTORY_CONTROL_PLANE",
      correlationId: "corr_job_retry",
      metadata: expect.objectContaining({
        jobId: "job_123",
        operation: "retry_job",
      }),
    }));
    expect(enqueueRecoveryOperation).toHaveBeenCalledWith({
      tenantId: "tenant_owner",
      type: "retry_job",
      jobId: "job_123",
    });
  });

  it("accepts retry-domain-verify requests and records an audit event", async () => {
    const { requestRetryDomainVerifyOperation, recordCampamentoEvent, enqueueRecoveryOperation } = await loadSubject();
    recordCampamentoEvent.mockResolvedValue(undefined);
    enqueueRecoveryOperation.mockResolvedValue({ id: "op_domain_1", status: "pending" });

    const result = await requestRetryDomainVerifyOperation({
      tenantId: "tenant_owner",
      domain: "Foo.Drako.Systems",
      correlationId: "corr_domain_retry",
    });

    expect(result).toEqual({
      ok: true,
      accepted: true,
    });
    expect(recordCampamentoEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_owner",
      type: "factory.recovery.retry_domain_verify.requested",
      source: "FACTORY_CONTROL_PLANE",
      correlationId: "corr_domain_retry",
      metadata: expect.objectContaining({
        domain: "foo.drako.systems",
        operation: "retry_domain_verify",
      }),
    }));
    expect(enqueueRecoveryOperation).toHaveBeenCalledWith({
      tenantId: "tenant_owner",
      type: "retry_domain_verify",
      domain: "foo.drako.systems",
    });
  });

  it("rejects invalid job ids", async () => {
    const { requestRetryJobOperation, FactoryRecoveryOperationError, recordCampamentoEvent, enqueueRecoveryOperation } = await loadSubject();

    await expect(requestRetryJobOperation({
      tenantId: "tenant_owner",
      jobId: "",
    })).rejects.toMatchObject<Partial<InstanceType<typeof FactoryRecoveryOperationError>>>({
      code: "INVALID_JOB_ID",
      status: 400,
    });
    expect(recordCampamentoEvent).not.toHaveBeenCalled();
    expect(enqueueRecoveryOperation).not.toHaveBeenCalled();
  });

  it("rejects invalid domains", async () => {
    const { requestRetryDomainVerifyOperation, FactoryRecoveryOperationError, recordCampamentoEvent, enqueueRecoveryOperation } = await loadSubject();

    await expect(requestRetryDomainVerifyOperation({
      tenantId: "tenant_owner",
      domain: "not a domain",
    })).rejects.toMatchObject<Partial<InstanceType<typeof FactoryRecoveryOperationError>>>({
      code: "INVALID_DOMAIN",
      status: 400,
    });
    expect(recordCampamentoEvent).not.toHaveBeenCalled();
    expect(enqueueRecoveryOperation).not.toHaveBeenCalled();
  });
});
