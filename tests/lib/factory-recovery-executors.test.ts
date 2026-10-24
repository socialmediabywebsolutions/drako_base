import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  const mod = await import("@/lib/factory/recovery-executors");

  return {
    ...mod,
    recordCampamentoEvent,
  };
}

describe("factory recovery executors", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("simulates retry job execution and records an event", async () => {
    const { executeRetryJob, recordCampamentoEvent } = await loadSubject();
    recordCampamentoEvent.mockResolvedValue(undefined);

    const result = await executeRetryJob("job_123", "tenant_owner");

    expect(result).toEqual({
      ok: true,
      success: true,
    });
    expect(recordCampamentoEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_owner",
      type: "factory.recovery.retry_job.executed",
      source: "FACTORY_RECOVERY_EXECUTOR",
      metadata: expect.objectContaining({
        jobId: "job_123",
        execution: "simulated",
      }),
    }));
  });

  it("simulates retry domain verification and records an event", async () => {
    const { executeRetryDomainVerify, recordCampamentoEvent } = await loadSubject();
    recordCampamentoEvent.mockResolvedValue(undefined);

    const result = await executeRetryDomainVerify("foo.drako.systems", "tenant_owner");

    expect(result).toEqual({
      ok: true,
      success: true,
    });
    expect(recordCampamentoEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "tenant_owner",
      type: "factory.recovery.retry_domain_verify.executed",
      source: "FACTORY_RECOVERY_EXECUTOR",
      metadata: expect.objectContaining({
        domain: "foo.drako.systems",
        execution: "simulated",
      }),
    }));
  });
});
