import { describe, expect, it } from "vitest";
import { buildLegacyAliasUsageReport } from "../../scripts/report-legacy-alias-usage";
import {
  buildLegacyAliasSunsetDecisionPack,
  renderLegacyAliasSunsetDecisionPack,
} from "../../scripts/prepare-legacy-alias-sunset-decision";

function createMatrixSnapshot() {
  return {
    summary: {
      counts: {
        ownerAliases: 1,
        campobaseAliases: 1,
      },
    },
    legacyAliases: {
      owner: [
        {
          routePath: "/api/owner/actions",
          filePath: "src/app/api/owner/actions/route.ts",
          canonicalTarget: "/api/operator/actions",
          status: "NEEDS_DEPRECATION" as const,
        },
      ],
      campobase: [
        {
          routePath: "/api/campobase/platform",
          filePath: "src/app/api/campobase/platform/route.ts",
          canonicalTarget: "/api/operator/platform",
          status: "LEGACY_COMPAT_ACCEPTED" as const,
        },
      ],
    },
  };
}

function buildReportWithCriteria(criteria: {
  rollbackPathExists: boolean;
  monitoringActive: boolean;
  observationWindowComplete: boolean;
  humanApprovalRecorded: boolean;
  additionalBlockers?: string[];
}) {
  return buildLegacyAliasUsageReport({
    mode: "json",
    now: "2026-06-01T00:00:00.000Z",
    rawEvents: [
      {
        eventType: "legacy.compat.route.hit",
        aliasType: "owner",
        legacyPath: "/api/owner/actions",
        canonicalTarget: "operator-api",
        method: "GET",
        timestamp: "2026-05-01T00:00:00.000Z",
        environment: "test",
        correlationId: "owner-old",
        source: "browser",
        host: "drako.systems",
        hostMode: "CAMPAMENTO_BASE",
        userAgentHash: "hash-owner",
        query: { token: "super-secret-token" },
        sensitiveDataRedacted: true,
      },
      {
        eventType: "legacy.compat.route.hit",
        aliasType: "campobase",
        legacyPath: "/api/campobase/platform",
        canonicalTarget: "operator-api",
        method: "GET",
        timestamp: "2026-05-01T00:00:00.000Z",
        environment: "test",
        correlationId: "campobase-old",
        source: "browser",
        host: "drako.systems",
        hostMode: "CAMPAMENTO_BASE",
        userAgentHash: "hash-campobase",
        query: { cookie: "session=abc" },
        sensitiveDataRedacted: true,
      },
    ],
    criteriaByAlias: {
      owner: {
        canonicalTargetExists: true,
        rollbackPathExists: criteria.rollbackPathExists,
        monitoringActive: criteria.monitoringActive,
        observationWindowComplete: criteria.observationWindowComplete,
        humanApprovalRecorded: criteria.humanApprovalRecorded,
        additionalBlockers: criteria.additionalBlockers,
      },
      campobase: {
        canonicalTargetExists: true,
        rollbackPathExists: criteria.rollbackPathExists,
        monitoringActive: criteria.monitoringActive,
        observationWindowComplete: criteria.observationWindowComplete,
        humanApprovalRecorded: criteria.humanApprovalRecorded,
        additionalBlockers: criteria.additionalBlockers,
      },
    },
  });
}

describe("prepare-legacy-alias-sunset-decision script", () => {
  it("NO_DATA does not produce cut", () => {
    const usageReport = buildLegacyAliasUsageReport({
      mode: "json",
      rawEvents: [],
      now: "2026-06-01T00:00:00.000Z",
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: "summary",
      matrixSnapshot: createMatrixSnapshot(),
      usageReport,
    });

    expect(pack.status).toBe("LEGACY_ALIAS_SUNSET_DECISION_NO_DATA");
    expect(pack.readyForCut).toBe(false);
    expect(pack.requiresHumanApproval).toBe(true);
    expect(pack.totals.byClass.KEEP_COMPAT).toBe(1);
    expect(pack.totals.byClass.READY_FOR_OBSERVATION).toBe(1);
  });

  it("without human approval it does not cut", () => {
    const usageReport = buildReportWithCriteria({
      rollbackPathExists: true,
      monitoringActive: true,
      observationWindowComplete: true,
      humanApprovalRecorded: false,
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: "summary",
      matrixSnapshot: createMatrixSnapshot(),
      usageReport,
    });

    expect(pack.readyForCut).toBe(false);
    expect(pack.status).toBe("LEGACY_ALIAS_SUNSET_DECISION_BLOCKED");
  });

  it("without rollback it does not cut", () => {
    const usageReport = buildReportWithCriteria({
      rollbackPathExists: false,
      monitoringActive: true,
      observationWindowComplete: true,
      humanApprovalRecorded: true,
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: "summary",
      matrixSnapshot: createMatrixSnapshot(),
      usageReport,
    });

    expect(pack.readyForCut).toBe(false);
    expect(pack.status).toBe("LEGACY_ALIAS_SUNSET_DECISION_BLOCKED");
  });

  it("without observation window it does not cut", () => {
    const usageReport = buildReportWithCriteria({
      rollbackPathExists: true,
      monitoringActive: true,
      observationWindowComplete: false,
      humanApprovalRecorded: true,
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: "summary",
      matrixSnapshot: createMatrixSnapshot(),
      usageReport,
    });

    expect(pack.readyForCut).toBe(false);
    expect(pack.status).toBe("LEGACY_ALIAS_SUNSET_DECISION_BLOCKED");
  });

  it("with hard blockers returns BLOCKED", () => {
    const usageReport = buildReportWithCriteria({
      rollbackPathExists: true,
      monitoringActive: true,
      observationWindowComplete: true,
      humanApprovalRecorded: true,
      additionalBlockers: ["CANONICAL_TARGET_MISSING"],
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: "summary",
      matrixSnapshot: createMatrixSnapshot(),
      usageReport,
    });

    expect(pack.status).toBe("LEGACY_ALIAS_SUNSET_DECISION_BLOCKED");
    expect(pack.totals.byClass.BLOCKED).toBeGreaterThan(0);
  });

  it("renders valid json and markdown", () => {
    const usageReport = buildLegacyAliasUsageReport({
      mode: "json",
      rawEvents: [],
      now: "2026-06-01T00:00:00.000Z",
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: "summary",
      matrixSnapshot: createMatrixSnapshot(),
      usageReport,
    });

    const jsonOutput = renderLegacyAliasSunsetDecisionPack(pack, "json");
    const markdownOutput = renderLegacyAliasSunsetDecisionPack(pack, "markdown");

    expect(() => JSON.parse(jsonOutput)).not.toThrow();
    expect(markdownOutput).toContain("# Legacy Alias Sunset Decision Pack");
  });

  it("never prints secrets tokens or cookies", () => {
    const usageReport = buildReportWithCriteria({
      rollbackPathExists: true,
      monitoringActive: true,
      observationWindowComplete: true,
      humanApprovalRecorded: true,
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: "summary",
      matrixSnapshot: createMatrixSnapshot(),
      usageReport,
    });
    const jsonOutput = renderLegacyAliasSunsetDecisionPack(pack, "json");

    expect(jsonOutput).not.toContain("super-secret-token");
    expect(jsonOutput).not.toContain("session=abc");
    expect(pack.requiresHumanApproval).toBe(true);
    expect(pack.readyForCut).toBe(false);
  });
});
