import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQueryAll = vi.fn();
const mockQueryOne = vi.fn();
const mockRun = vi.fn();

vi.mock("../db/runtime-db", () => ({
  ensureDracoDb: () => ({}) as D1Database,
  queryAll: (...args: unknown[]) => mockQueryAll(...args),
  queryOne: (...args: unknown[]) => mockQueryOne(...args),
  run: (...args: unknown[]) => mockRun(...args),
}));

import { generateRuntimeSocialFlowExportForTenant } from "./exports-service";

describe("runtime exports service hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryAll.mockResolvedValue([
      { name: "id" },
      { name: "tenant_id" },
      { name: "slug" },
      { name: "name" },
      { name: "blueprint_snapshot" },
      { name: "plan_tier" },
      { name: "mrr_eur" },
      { name: "cost_eur" },
      { name: "risk_level" },
    ]);
    mockQueryOne.mockResolvedValue(null);
  });

  it("fails closed when SocialFlow SaaS seed is missing instead of inventing fallback identity", async () => {
    await expect(generateRuntimeSocialFlowExportForTenant("tenant-missing-seed")).rejects.toThrow(
      "SOCIALFLOW_EXPORT_SAAS_SEED_NOT_FOUND",
    );
    expect(mockRun).not.toHaveBeenCalled();
  });
});
