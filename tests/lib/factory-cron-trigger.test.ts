import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();
  const runFactorySchedulerCycle = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  vi.doMock("@/lib/factory/factory-scheduler-worker", () => ({
    runFactorySchedulerCycle,
  }));

  const { runFactoryCronCycle } = await import("@/lib/factory/factory-cron-trigger");

  return {
    runFactoryCronCycle,
    recordCampamentoEvent,
    runFactorySchedulerCycle,
  };
}

describe("runFactoryCronCycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls runFactorySchedulerCycle", async () => {
    const {
      runFactoryCronCycle,
      recordCampamentoEvent,
      runFactorySchedulerCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    runFactorySchedulerCycle.mockResolvedValue(undefined);

    await runFactoryCronCycle();

    expect(runFactorySchedulerCycle).toHaveBeenCalledTimes(1);
  });

  it("registers started and completed events", async () => {
    const {
      runFactoryCronCycle,
      recordCampamentoEvent,
      runFactorySchedulerCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    runFactorySchedulerCycle.mockResolvedValue(undefined);

    await runFactoryCronCycle();

    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tenantId: "system",
      type: "factory.cron.cycle.started",
      source: "FACTORY_CRON_TRIGGER",
      message: "Factory cron cycle started.",
      metadata: {
        subsystem: "scheduler",
      },
    }));
    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      tenantId: "system",
      type: "factory.cron.cycle.completed",
      source: "FACTORY_CRON_TRIGGER",
      message: "Factory cron cycle completed.",
      metadata: {
        subsystem: "scheduler",
      },
    }));
  });
});
