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

  it("leaves Campobase legacy adapter intact and canonical service uses internal API client", () => {
    const adapterSource = readFileSync("src/lib/campobase/socialflow-service.ts", "utf8");
    const canonicalSource = readFileSync("src/lib/campamento-base/socialflow-control-plane-service.ts", "utf8");

    expect(adapterSource).toContain("@/lib/campamento-base/socialflow-control-plane-service");
    expect(canonicalSource).toContain("@/lib/capabilities/internal-api-clients/socialflow-control-plane");
  });
});
