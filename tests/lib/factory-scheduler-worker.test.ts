import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();
  const triggerRecoveryCycle = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  vi.doMock("@/lib/factory/recovery-scheduler", () => ({
    triggerRecoveryCycle,
  }));

  const { runFactorySchedulerCycle } = await import("@/lib/factory/factory-scheduler-worker");

  return {
    runFactorySchedulerCycle,
    recordCampamentoEvent,
    triggerRecoveryCycle,
  };
}

describe("runFactorySchedulerCycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls triggerRecoveryCycle", async () => {
    const {
      runFactorySchedulerCycle,
      recordCampamentoEvent,
      triggerRecoveryCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    triggerRecoveryCycle.mockResolvedValue(undefined);

    await runFactorySchedulerCycle();

    expect(triggerRecoveryCycle).toHaveBeenCalledTimes(1);
  });

  it("registers started and completed events", async () => {
    const {
      runFactorySchedulerCycle,
      recordCampamentoEvent,
      triggerRecoveryCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    triggerRecoveryCycle.mockResolvedValue(undefined);

    await runFactorySchedulerCycle();

    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tenantId: "system",
      type: "factory.scheduler.cycle.started",
      source: "FACTORY_SCHEDULER_WORKER",
      message: "Factory scheduler cycle started.",
      metadata: {
        subsystem: "recovery",
      },
    }));
    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      tenantId: "system",
      type: "factory.scheduler.cycle.completed",
      source: "FACTORY_SCHEDULER_WORKER",
      message: "Factory scheduler cycle completed.",
      metadata: {
        subsystem: "recovery",
      },
    }));
  });
});
