import { describe, expect, it } from "vitest";
import {
  buildLegacyAliasUsageReport,
  parseLegacyAliasTelemetrySource,
  renderLegacyAliasUsageReport,
} from "../../scripts/report-legacy-alias-usage";

describe("report-legacy-alias-usage script", () => {
  it("returns NO_DATA when there is no telemetry", () => {
    const report = buildLegacyAliasUsageReport({
      mode: "summary",
      rawEvents: [],
      now: "2026-06-01T00:00:00.000Z",
    });

    expect(report.status).toBe("LEGACY_ALIAS_USAGE_REPORT_NO_DATA");
    expect(report.summary.status).toBe("NO_DATA");
    expect(report.summary.readyForCut).toBe(false);
    expect(report.summary.requiresHumanApproval).toBe(true);
  });

  it("returns BLOCKED when recent activity exists", () => {
    const report = buildLegacyAliasUsageReport({
      mode: "summary",
      now: "2026-06-01T00:00:00.000Z",
      rawEvents: [
        {
          eventType: "legacy.compat.route.hit",
          aliasType: "owner",
          legacyPath: "/api/owner/actions",
          canonicalTarget: "operator-api",
          method: "GET",
          timestamp: "2026-06-01T00:00:00.000Z",
          environment: "test",
          correlationId: "owner-recent",
          source: "browser",
          host: "drako.systems",
          hostMode: "CAMPAMENTO_BASE",
          userAgentHash: "hash",
          query: {},
          sensitiveDataRedacted: true,
        },
      ],
      criteriaByAlias: {
        owner: {
          rollbackPathExists: true,
          monitoringActive: true,
          observationWindowComplete: true,
          humanApprovalRecorded: true,
          canonicalTargetExists: true,
        },
        campobase: {
          rollbackPathExists: true,
          monitoringActive: true,
          observationWindowComplete: true,
          humanApprovalRecorded: true,
          canonicalTargetExists: true,
        },
      },
    });

    expect(report.status).toBe("LEGACY_ALIAS_USAGE_REPORT_BLOCKED");
    expect(report.summary.byAlias.owner.blockers).toContain("RECENT_HITS_PRESENT");
    expect(report.summary.readyForCut).toBe(false);
  });

  it("returns OK only with complete cut criteria", () => {
    const report = buildLegacyAliasUsageReport({
      mode: "summary",
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
          userAgentHash: "hash",
          query: {},
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
          userAgentHash: "hash",
          query: {},
          sensitiveDataRedacted: true,
        },
      ],
      criteriaByAlias: {
        owner: {
          rollbackPathExists: true,
          monitoringActive: true,
          observationWindowComplete: true,
          humanApprovalRecorded: true,
          canonicalTargetExists: true,
        },
        campobase: {
          rollbackPathExists: true,
          monitoringActive: true,
          observationWindowComplete: true,
          humanApprovalRecorded: true,
          canonicalTargetExists: true,
        },
      },
    });

    expect(report.status).toBe("LEGACY_ALIAS_USAGE_REPORT_OK");
    expect(report.summary.readyForCut).toBe(true);
    expect(report.decision.requiresHumanApproval).toBe(true);
  });

  it("renders valid json and markdown outputs", () => {
    const report = buildLegacyAliasUsageReport({
      mode: "summary",
      rawEvents: [],
      now: "2026-06-01T00:00:00.000Z",
    });
    const jsonOutput = renderLegacyAliasUsageReport(report, "json");
    const markdownOutput = renderLegacyAliasUsageReport(report, "markdown");

    expect(() => JSON.parse(jsonOutput)).not.toThrow();
    expect(markdownOutput).toContain("# Legacy Alias Usage Report");
    expect(markdownOutput).toContain("LEGACY_ALIAS_USAGE_REPORT_NO_DATA");
  });

  it("never prints token/cookie/secret values in report output", () => {
    const report = buildLegacyAliasUsageReport({
      mode: "summary",
      now: "2026-06-01T00:00:00.000Z",
      rawEvents: [
        {
          eventType: "legacy.compat.route.hit",
          aliasType: "owner",
          legacyPath: "/api/owner/events",
          canonicalTarget: "operator-api",
          method: "GET",
          timestamp: "2026-05-31T00:00:00.000Z",
          environment: "test",
          correlationId: "owner-token",
          source: "service",
          host: "drako.systems",
          hostMode: "CAMPAMENTO_BASE",
          userAgentHash: "hash",
          query: { token: "super-secret-token", cookie: "session=abc" },
          sensitiveDataRedacted: true,
        },
      ],
      criteriaByAlias: {
        owner: {
          rollbackPathExists: true,
          monitoringActive: true,
          observationWindowComplete: true,
          humanApprovalRecorded: true,
          canonicalTargetExists: true,
        },
        campobase: {
          rollbackPathExists: true,
          monitoringActive: true,
          observationWindowComplete: true,
          humanApprovalRecorded: true,
          canonicalTargetExists: true,
        },
      },
    });

    const jsonOutput = renderLegacyAliasUsageReport(report, "json");
    expect(jsonOutput).not.toContain("super-secret-token");
    expect(jsonOutput).not.toContain("session=abc");
    expect(report.summary.sensitiveDataRedactedCount).toBe(1);
  });

  it("parses json and jsonl telemetry sources", () => {
    const jsonSource = JSON.stringify([
      { eventType: "legacy.compat.route.hit", aliasType: "owner", legacyPath: "/api/owner/actions" },
    ]);
    const jsonlSource = [
      '{"eventType":"legacy.compat.route.hit","aliasType":"campobase","legacyPath":"/api/campobase/platform"}',
    ].join("\n");

    const jsonEvents = parseLegacyAliasTelemetrySource(jsonSource);
    const jsonlEvents = parseLegacyAliasTelemetrySource(jsonlSource);

    expect(jsonEvents).toHaveLength(1);
    expect(jsonlEvents).toHaveLength(1);
  });
});
