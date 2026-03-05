import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  run: vi.fn(),
  recordCampamentoEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  queryAll: mocks.queryAll,
  queryOne: mocks.queryOne,
  run: mocks.run,
}));

vi.mock("@/lib/empire/events", () => ({
  recordCampamentoEvent: mocks.recordCampamentoEvent,
}));

import { replayObservabilityFallbacks } from "../scripts/replay-observability-fallbacks";

describe("replay observability fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replays fallback events and deletes processed rows", async () => {
    mocks.queryAll.mockResolvedValue([
      {
        id: "fb_1",
        created_at: "2026-03-05T09:00:00.000Z",
        correlation_id: "corr_1",
        tenant_id: "tenant_a",
        job_id: "job_1",
        step: "domains",
        severity: "ERROR",
        message: "failed write",
      },
    ]);
    mocks.queryOne.mockResolvedValue(null);
    mocks.recordCampamentoEvent.mockResolvedValue(undefined);
    mocks.run.mockResolvedValue(true);

    const report = await replayObservabilityFallbacks({ limit: 10, log: () => {} });

    expect(report).toMatchObject({
      scanned: 1,
      replayed: 1,
      alreadyExists: 0,
      deleted: 1,
      errors: 0,
    });
    expect(mocks.recordCampamentoEvent).toHaveBeenCalledTimes(1);
    expect(mocks.run).toHaveBeenCalledWith("DELETE FROM campamento_event_fallbacks WHERE id = ?", "fb_1");
  });

  it("does not duplicate when replay event already exists", async () => {
    mocks.queryAll.mockResolvedValue([
      {
        id: "fb_2",
        created_at: "2026-03-05T09:00:00.000Z",
        correlation_id: "corr_dup",
        tenant_id: "tenant_a",
        job_id: "job_dup",
        step: "stripe",
        severity: "ERROR",
        message: "failed write",
      },
    ]);
    mocks.queryOne.mockResolvedValue({ id: "evt_existing" });
    mocks.run.mockResolvedValue(true);

    const report = await replayObservabilityFallbacks({ limit: 10, log: () => {} });

    expect(report).toMatchObject({
      scanned: 1,
      replayed: 0,
      alreadyExists: 1,
      deleted: 1,
      errors: 0,
    });
    expect(mocks.recordCampamentoEvent).not.toHaveBeenCalled();
    expect(mocks.run).toHaveBeenCalledWith("DELETE FROM campamento_event_fallbacks WHERE id = ?", "fb_2");
  });
});
