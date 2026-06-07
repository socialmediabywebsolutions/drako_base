import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("owner control dashboard socialflow internal api wiring", () => {
  it("owner control dashboard no longer imports legacy owner-dashboard contract", () => {
    const ownerControlDashboardSource = readFileSync(
      "src/lib/owner/control-dashboard.ts",
      "utf8",
    );

    expect(ownerControlDashboardSource).not.toContain("@/lib/socialflow/contracts/owner-dashboard");
    expect(ownerControlDashboardSource).toContain("@/lib/capabilities/internal-api-clients/socialflow-owner");
    expect(ownerControlDashboardSource).toContain("fetchSocialFlowOwnerSnapshot");
    expect(ownerControlDashboardSource).toContain("mapSocialFlowOwnerSnapshotToLegacyDashboard");
  });

  it("keeps expected social and socialConversion shape mapping", () => {
    const ownerControlDashboardSource = readFileSync(
      "src/lib/owner/control-dashboard.ts",
      "utf8",
    );

    expect(ownerControlDashboardSource).toContain("socialSummary = ownerSummary");
    expect(ownerControlDashboardSource).toContain("totalAppointmentsFromSocial");
    expect(ownerControlDashboardSource).toContain("totalRevenueFromSocial");
    expect(ownerControlDashboardSource).toContain("topCampaignName");
    expect(ownerControlDashboardSource).toContain("topCampaignRevenue");
  });

  it("leaves Campobase legacy contract import untouched", () => {
    const campobaseSource = readFileSync(
      "src/lib/campobase/socialflow-service.ts",
      "utf8",
    );

    expect(campobaseSource).toContain("@/lib/socialflow/contracts/campobase");
  });
});
