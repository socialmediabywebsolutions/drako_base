import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  return import("@/lib/factory/recovery-queue");
}

describe("factory recovery queue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("enqueues pending recovery operations", async () => {
    const { enqueueRecoveryOperation, listPendingRecoveryOperations } = await loadSubject();

    const enqueued = await enqueueRecoveryOperation({
      tenantId: "tenant_owner",
      type: "retry_job",
      jobId: "job_123",
    });

    expect(enqueued).toEqual({
      id: expect.any(String),
      status: "pending",
    });

    const operations = await listPendingRecoveryOperations({ tenantId: "tenant_owner" });

    expect(operations).toEqual([
      expect.objectContaining({
        id: enqueued.id,
        tenantId: "tenant_owner",
        type: "retry_job",
        jobId: "job_123",
        status: "pending",
        createdAt: expect.any(Number),
      }),
    ]);
  });

  it("lists only pending operations and supports tenant filtering", async () => {
    const { enqueueRecoveryOperation, listPendingRecoveryOperations } = await loadSubject();

    await enqueueRecoveryOperation({
      tenantId: "tenant_a",
      type: "retry_job",
      jobId: "job_a",
    });
    await enqueueRecoveryOperation({
      tenantId: "tenant_b",
      type: "retry_domain_verify",
      domain: "foo.drako.systems",
    });

    const tenantA = await listPendingRecoveryOperations({ tenantId: "tenant_a" });
    const tenantB = await listPendingRecoveryOperations({ tenantId: "tenant_b" });

    expect(tenantA).toHaveLength(1);
    expect(tenantA[0]).toMatchObject({
      tenantId: "tenant_a",
      type: "retry_job",
      jobId: "job_a",
    });

    expect(tenantB).toHaveLength(1);
    expect(tenantB[0]).toMatchObject({
      tenantId: "tenant_b",
      type: "retry_domain_verify",
      domain: "foo.drako.systems",
    });
  });

  it("returns operations in most-recent-first order and respects limit", async () => {
    const { enqueueRecoveryOperation, listPendingRecoveryOperations } = await loadSubject();

    await enqueueRecoveryOperation({
      tenantId: "tenant_owner",
      type: "retry_job",
      jobId: "job_old",
    });
    await enqueueRecoveryOperation({
      tenantId: "tenant_owner",
      type: "retry_job",
      jobId: "job_new",
    });

    const operations = await listPendingRecoveryOperations({ tenantId: "tenant_owner", limit: 1 });

    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      tenantId: "tenant_owner",
      jobId: "job_new",
    });
  });

  it("marks operations as completed so they no longer appear in pending lists", async () => {
    const { enqueueRecoveryOperation, listPendingRecoveryOperations, markRecoveryOperationCompleted } = await loadSubject();

    const enqueued = await enqueueRecoveryOperation({
      tenantId: "tenant_owner",
      type: "retry_domain_verify",
      domain: "foo.drako.systems",
    });

    await expect(markRecoveryOperationCompleted(enqueued.id)).resolves.toBe(true);

    const operations = await listPendingRecoveryOperations({ tenantId: "tenant_owner" });

    expect(operations).toEqual([]);
    await expect(markRecoveryOperationCompleted(enqueued.id)).resolves.toBe(false);
  });
});
