import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isDatabaseAvailable: vi.fn(),
  startWorkers: vi.fn(),
}));

vi.mock("@/lib/mentoria/db", () => ({
  isDatabaseAvailable: mocks.isDatabaseAvailable,
}));

vi.mock("@/lib/mentoria/resilience/orchestrator", () => ({
  getMentoriaOrchestrator: () => ({
    startWorkers: mocks.startWorkers,
  }),
}));

describe("initializeMentoriaWorkers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.isDatabaseAvailable.mockReturnValue(true);
    mocks.startWorkers.mockResolvedValue(undefined);
  });

  it("starts workers once under concurrent initialization", async () => {
    const { initializeMentoriaWorkers } = await import("@/lib/mentoria/resilience/startup");

    await Promise.all([
      initializeMentoriaWorkers(),
      initializeMentoriaWorkers(),
      initializeMentoriaWorkers(),
    ]);

    expect(mocks.startWorkers).toHaveBeenCalledTimes(1);

    await initializeMentoriaWorkers();
    expect(mocks.startWorkers).toHaveBeenCalledTimes(1);
  });

  it("fails safe when DB bindings are unavailable", async () => {
    mocks.isDatabaseAvailable.mockReturnValue(false);
    const { initializeMentoriaWorkers } = await import("@/lib/mentoria/resilience/startup");

    await initializeMentoriaWorkers();

    expect(mocks.startWorkers).not.toHaveBeenCalled();
  });
});
