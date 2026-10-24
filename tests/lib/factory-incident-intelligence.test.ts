import { beforeEach, describe, expect, it, vi } from "vitest";

async function loadSubject() {
  const recordCampamentoEvent = vi.fn();

  vi.doMock("@/lib/empire/events", () => ({
    recordCampamentoEvent,
  }));

  const { recordFactoryIncidentIfNeeded } = await import("@/lib/factory/factory-incident-intelligence");

  return {
    recordCampamentoEvent,
    recordFactoryIncidentIfNeeded,
  };
}

describe("recordFactoryIncidentIfNeeded", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("does nothing when outcome is stable", async () => {
    const {
      recordCampamentoEvent,
      recordFactoryIncidentIfNeeded,
    } = await loadSubject();

    await recordFactoryIncidentIfNeeded("stable");

    expect(recordCampamentoEvent).not.toHaveBeenCalled();
  });

  it("records an incident when outcome is not stable", async () => {
    const {
      recordCampamentoEvent,
      recordFactoryIncidentIfNeeded,
    } = await loadSubject();

    recordCampamentoEvent.mockResolvedValue(undefined);

    await recordFactoryIncidentIfNeeded("degraded");

    expect(recordCampamentoEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: "system",
      type: "factory.incident.detected",
      source: "FACTORY_INCIDENT_INTELLIGENCE",
      message: "Factory incident detected after health loop.",
      metadata: {
        subsystem: "factory",
        outcome: "degraded",
      },
    }));
  });
});
