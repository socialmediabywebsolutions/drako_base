import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();
  const runScheduledRecoveryCycle = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  vi.doMock("@/lib/factory/recovery-runner", () => ({
    runScheduledRecoveryCycle,
  }));

  const { triggerRecoveryCycle } = await import("@/lib/factory/recovery-scheduler");

  return {
    triggerRecoveryCycle,
    recordCampamentoEvent,
    runScheduledRecoveryCycle,
  };
}

describe("triggerRecoveryCycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls runScheduledRecoveryCycle", async () => {
    const {
      triggerRecoveryCycle,
      recordCampamentoEvent,
      runScheduledRecoveryCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    runScheduledRecoveryCycle.mockResolvedValue(undefined);

    await triggerRecoveryCycle();

    expect(runScheduledRecoveryCycle).toHaveBeenCalledTimes(1);
  });

  it("registers the scheduler triggered event", async () => {
    const {
      triggerRecoveryCycle,
      recordCampamentoEvent,
      runScheduledRecoveryCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    runScheduledRecoveryCycle.mockResolvedValue(undefined);

    await triggerRecoveryCycle();

    expect(recordCampamentoEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "system",
      type: "factory.recovery.scheduler.triggered",
      source: "FACTORY_RECOVERY_SCHEDULER",
      message: "Factory recovery cycle triggered.",
      metadata: {
        trigger: "manual",
      },
    }));
  });
});
