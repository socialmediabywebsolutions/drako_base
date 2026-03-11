import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();
  const runFactoryCronCycle = vi.fn();
  const recordFactoryIncidentIfNeeded = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  vi.doMock("@/lib/factory/factory-cron-trigger", () => ({
    runFactoryCronCycle,
  }));

  vi.doMock("@/lib/factory/factory-incident-intelligence", () => ({
    recordFactoryIncidentIfNeeded,
  }));

  const { runFactoryHealthLoop } = await import("@/lib/factory/factory-health-loop");

  return {
    runFactoryHealthLoop,
    recordCampamentoEvent,
    recordFactoryIncidentIfNeeded,
    runFactoryCronCycle,
  };
}

describe("runFactoryHealthLoop", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls runFactoryCronCycle", async () => {
    const {
      runFactoryHealthLoop,
      recordCampamentoEvent,
      recordFactoryIncidentIfNeeded,
      runFactoryCronCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    recordFactoryIncidentIfNeeded.mockResolvedValue(undefined);
    runFactoryCronCycle.mockResolvedValue(undefined);

    await runFactoryHealthLoop();

    expect(runFactoryCronCycle).toHaveBeenCalledTimes(1);
  });

  it("registers started and completed events", async () => {
    const {
      runFactoryHealthLoop,
      recordCampamentoEvent,
      recordFactoryIncidentIfNeeded,
      runFactoryCronCycle,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    recordFactoryIncidentIfNeeded.mockResolvedValue(undefined);
    runFactoryCronCycle.mockResolvedValue(undefined);

    await runFactoryHealthLoop();

    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tenantId: "system",
      type: "factory.health.cycle.started",
      source: "FACTORY_HEALTH_LOOP",
      message: "Factory health cycle started.",
      metadata: {
        subsystem: "factory",
        stage: "post-recovery",
      },
    }));
    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      tenantId: "system",
      type: "factory.health.cycle.completed",
      source: "FACTORY_HEALTH_LOOP",
      message: "Factory health cycle completed.",
      metadata: {
        subsystem: "factory",
        stage: "post-recovery",
        outcome: "stable",
      },
    }));
    expect(recordFactoryIncidentIfNeeded).toHaveBeenCalledWith("stable");
  });
});
