import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const listPendingRecoveryOperations = vi.fn();
  const markRecoveryOperationCompleted = vi.fn();
  const recordCampamentoEvent = vi.fn();
  const executeRetryJob = vi.fn();
  const executeRetryDomainVerify = vi.fn();

  vi.doMock("@/lib/factory/recovery-queue", () => ({
    listPendingRecoveryOperations,
    markRecoveryOperationCompleted,
  }));

  vi.doMock("@/lib/factory/recovery-executors", () => ({
    executeRetryJob,
    executeRetryDomainVerify,
  }));

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  const { processPendingRecoveryOperations } = await import("@/lib/factory/recovery-worker");

  return {
    processPendingRecoveryOperations,
    listPendingRecoveryOperations,
    markRecoveryOperationCompleted,
    recordCampamentoEvent,
    executeRetryJob,
    executeRetryDomainVerify,
  };
}

describe("processPendingRecoveryOperations", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("processes pending recovery operations in queue order", async () => {
    const {
      processPendingRecoveryOperations,
      listPendingRecoveryOperations,
      markRecoveryOperationCompleted,
      recordCampamentoEvent,
      executeRetryJob,
      executeRetryDomainVerify,
    } = await loadSubject();

    listPendingRecoveryOperations.mockResolvedValue([
      {
        id: "op_2",
        tenantId: "tenant_owner",
        type: "retry_domain_verify",
        domain: "foo.drako.systems",
        createdAt: 2,
        status: "pending",
      },
      {
        id: "op_1",
        tenantId: "tenant_owner",
        type: "retry_job",
        jobId: "job_1",
        createdAt: 1,
        status: "pending",
      },
    ]);
    executeRetryJob.mockResolvedValue({ ok: true, success: true });
    executeRetryDomainVerify.mockResolvedValue({ ok: true, success: true });
    recordCampamentoEvent.mockResolvedValue(undefined);
    markRecoveryOperationCompleted.mockResolvedValue(true);

    await processPendingRecoveryOperations();

    expect(listPendingRecoveryOperations).toHaveBeenCalledWith();
    expect(executeRetryDomainVerify).toHaveBeenNthCalledWith(1, "foo.drako.systems", "tenant_owner");
    expect(executeRetryJob).toHaveBeenNthCalledWith(1, "job_1", "tenant_owner");
    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tenantId: "tenant_owner",
      type: "factory.recovery.retry_domain_verify.completed",
      source: "FACTORY_RECOVERY_WORKER",
      correlationId: "op_2",
      metadata: expect.objectContaining({
        operationId: "op_2",
        domain: "foo.drako.systems",
        status: "completed",
      }),
    }));
    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      tenantId: "tenant_owner",
      type: "factory.recovery.retry_job.completed",
      source: "FACTORY_RECOVERY_WORKER",
      correlationId: "op_1",
      metadata: expect.objectContaining({
        operationId: "op_1",
        jobId: "job_1",
        status: "completed",
      }),
    }));
    expect(markRecoveryOperationCompleted).toHaveBeenNthCalledWith(1, "op_2");
    expect(markRecoveryOperationCompleted).toHaveBeenNthCalledWith(2, "op_1");
  });

  it("marks each processed operation as completed", async () => {
    const {
      processPendingRecoveryOperations,
      listPendingRecoveryOperations,
      markRecoveryOperationCompleted,
      recordCampamentoEvent,
      executeRetryJob,
    } = await loadSubject();

    listPendingRecoveryOperations.mockResolvedValue([
      {
        id: "op_job",
        tenantId: "tenant_owner",
        type: "retry_job",
        jobId: "job_1",
        createdAt: 1,
        status: "pending",
      },
    ]);
    executeRetryJob.mockResolvedValue({ ok: true, success: true });
    recordCampamentoEvent.mockResolvedValue(undefined);
    markRecoveryOperationCompleted.mockResolvedValue(true);

    await processPendingRecoveryOperations();

    expect(markRecoveryOperationCompleted).toHaveBeenCalledTimes(1);
    expect(markRecoveryOperationCompleted).toHaveBeenCalledWith("op_job");
  });

  it("registers an audit event for each processed operation", async () => {
    const {
      processPendingRecoveryOperations,
      listPendingRecoveryOperations,
      markRecoveryOperationCompleted,
      recordCampamentoEvent,
      executeRetryDomainVerify,
    } = await loadSubject();

    listPendingRecoveryOperations.mockResolvedValue([
      {
        id: "op_domain",
        tenantId: "tenant_owner",
        type: "retry_domain_verify",
        domain: "foo.drako.systems",
        createdAt: 1,
        status: "pending",
      },
    ]);
    executeRetryDomainVerify.mockResolvedValue({ ok: true, success: true });
    recordCampamentoEvent.mockResolvedValue(undefined);
    markRecoveryOperationCompleted.mockResolvedValue(true);

    await processPendingRecoveryOperations();

    expect(recordCampamentoEvent).toHaveBeenCalledTimes(1);
    expect(recordCampamentoEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_owner",
      type: "factory.recovery.retry_domain_verify.completed",
      message: "Recovery worker accepted retry for domain foo.drako.systems.",
    }));
  });
});
