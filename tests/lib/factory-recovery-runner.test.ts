import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();
  const processPendingRecoveryOperations = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  vi.doMock("@/lib/factory/recovery-worker", () => ({
    processPendingRecoveryOperations,
  }));

  const { runScheduledRecoveryCycle } = await import("@/lib/factory/recovery-runner");

  return {
    runScheduledRecoveryCycle,
    recordCampamentoEvent,
    processPendingRecoveryOperations,
  };
}

describe("runScheduledRecoveryCycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("calls processPendingRecoveryOperations", async () => {
    const {
      runScheduledRecoveryCycle,
      recordCampamentoEvent,
      processPendingRecoveryOperations,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    processPendingRecoveryOperations.mockResolvedValue(2);

    await runScheduledRecoveryCycle();

    expect(processPendingRecoveryOperations).toHaveBeenCalledTimes(1);
  });

  it("registers start and completed events with processed count", async () => {
    const {
      runScheduledRecoveryCycle,
      recordCampamentoEvent,
      processPendingRecoveryOperations,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);
    processPendingRecoveryOperations.mockResolvedValue(3);

    await runScheduledRecoveryCycle();

    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({
      tenantId: "system",
      type: "factory.recovery.cycle.started",
      source: "FACTORY_RECOVERY_RUNNER",
      message: "Scheduled factory recovery cycle started.",
    }));
    expect(recordCampamentoEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({
      tenantId: "system",
      type: "factory.recovery.cycle.completed",
      source: "FACTORY_RECOVERY_RUNNER",
      message: "Scheduled factory recovery cycle completed.",
      metadata: {
        processedOperationsCount: 3,
      },
    }));
  });
});
