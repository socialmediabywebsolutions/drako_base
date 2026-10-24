import { describe, expect, it } from "vitest";

import { summarizeFactoryIncidents } from "@/lib/factory/factory-incident-summaries";

describe("summarizeFactoryIncidents", () => {
  it("returns an empty summary for an empty array", () => {
    expect(summarizeFactoryIncidents([])).toEqual({
      total: 0,
      stableCount: 0,
      degradedCount: 0,
      improvedCount: 0,
      lastOutcome: null,
    });
  });

  it("counts stable outcomes", () => {
    expect(summarizeFactoryIncidents(["stable", "stable"])).toEqual({
      total: 2,
      stableCount: 2,
      degradedCount: 0,
      improvedCount: 0,
      lastOutcome: "stable",
    });
  });

  it("counts mixed stable, degraded and improved outcomes", () => {
    expect(summarizeFactoryIncidents(["stable", "degraded", "improved", "degraded"])).toEqual({
      total: 4,
      stableCount: 1,
      degradedCount: 2,
      improvedCount: 1,
      lastOutcome: "degraded",
    });
  });

  it("returns the last outcome", () => {
    expect(summarizeFactoryIncidents(["improved", "stable"])).toEqual(
      expect.objectContaining({
        lastOutcome: "stable",
      }),
    );
  });
});
