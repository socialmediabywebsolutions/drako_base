import { describe, expect, it } from "vitest";
import { auditSocialflowRuntimeCutoverBlockers } from "../scripts/audit-socialflow-runtime-cutover-blockers";

describe("socialflow runtime cutover blockers audit", () => {
  it("passes and reports blocked by design", async () => {
    const report = await auditSocialflowRuntimeCutoverBlockers({});

    expect(report.ok).toBe(true);
    expect(report.status).toBe("SOCIALFLOW_RUNTIME_CUTOVER_BLOCKERS_AUDIT_OK");
    expect(report.blockers.deployable).toBe("BLOCKED_BY_DESIGN");
    expect(report.blockers.canaryConfig).toBe("READY");
    expect(report.blockers.allSwitchesOn).toBe("READY");
    expect(report.blockers.dnsRouting).toBe("NEEDS_DNS_CUTOVER");
  });

  it("generates valid JSON", async () => {
    const report = await auditSocialflowRuntimeCutoverBlockers({ json: true });
    const jsonString = JSON.stringify(report);
    expect(() => JSON.parse(jsonString)).not.toThrow();
  });
});
