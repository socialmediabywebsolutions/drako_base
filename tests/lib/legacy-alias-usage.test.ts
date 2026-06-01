import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLegacyAliasTelemetryEvent,
  normalizeLegacyAliasTelemetryEvents,
  recordLegacyAliasUsageTelemetry,
  sanitizeLegacyAliasQueryParams,
  setLegacyAliasTelemetrySinkForTests,
  summarizeLegacyAliasUsage,
  type LegacyAliasTelemetryEvent,
} from "@/lib/observability/legacy-alias-usage";

function buildRequestContext(url: string, headersInit: HeadersInit = {}) {
  const parsed = new URL(url);
  return {
    headers: new Headers(headersInit),
    nextUrl: {
      searchParams: parsed.searchParams,
    },
  };
}

describe("legacy alias usage telemetry", () => {
  afterEach(() => {
    setLegacyAliasTelemetrySinkForTests(null);
    vi.restoreAllMocks();
  });

  it("redacts sensitive query params", () => {
    const query = new URLSearchParams("page=1&token=super-secret&access_token=abc123&filter=active&code=xyz");
    const sanitized = sanitizeLegacyAliasQueryParams(query);

    expect(sanitized.page).toBe("1");
    expect(sanitized.filter).toBe("active");
    expect(sanitized.token).toBe("[REDACTED]");
    expect(sanitized.access_token).toBe("[REDACTED]");
    expect(sanitized.code).toBe("[REDACTED]");
  });

  it("builds a safe event without leaking auth headers or cookies", () => {
    const event = buildLegacyAliasTelemetryEvent({
      requestBindings: null,
      aliasType: "owner",
      legacyPath: "/api/owner/events",
      canonicalTarget: "operator-api",
      method: "get",
      correlationId: "corr-001",
      host: "drako.systems",
      hostMode: "CAMPAMENTO_BASE",
      request: buildRequestContext("https://drako.systems/api/owner/events?access_token=token-value&view=timeline", {
        "user-agent": "Mozilla/5.0",
        Authorization: "Bearer top-secret",
        Cookie: "session=abc",
      }),
      sampleRate: 1,
    });

    expect(event.aliasType).toBe("owner");
    expect(event.legacyPath).toBe("/api/owner/events");
    expect(event.canonicalTarget).toBe("operator-api");
    expect(event.method).toBe("GET");
    expect(event.source).toBe("browser");
    expect(event.sensitiveDataRedacted).toBe(true);
    expect(event.query.access_token).toBe("[REDACTED]");
    expect(event.query.view).toBe("timeline");

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("top-secret");
    expect(serialized).not.toContain("session=abc");
    expect(serialized).not.toContain("token-value");
  });

  it("records both owner and campobase aliases through the non-blocking sink", async () => {
    const captured: LegacyAliasTelemetryEvent[] = [];
    setLegacyAliasTelemetrySinkForTests((event) => {
      captured.push(event);
    });

    await recordLegacyAliasUsageTelemetry({
      requestBindings: null,
      aliasType: "owner",
      legacyPath: "/api/owner/tasks",
      canonicalTarget: "operator-api",
      method: "POST",
      correlationId: "corr-owner",
      host: "drako.systems",
      hostMode: "CAMPAMENTO_BASE",
      request: buildRequestContext("https://drako.systems/api/owner/tasks?tenantId=t_123", {
        "user-agent": "Mozilla/5.0",
      }),
      sampleRate: 1,
    });

    await recordLegacyAliasUsageTelemetry({
      requestBindings: null,
      aliasType: "campobase",
      legacyPath: "/api/campobase/platform",
      canonicalTarget: "operator-api",
      method: "GET",
      correlationId: "corr-campobase",
      host: "drako.systems",
      hostMode: "CAMPAMENTO_BASE",
      request: buildRequestContext("https://drako.systems/api/campobase/platform?state=legacy"),
      sampleRate: 1,
    });

    expect(captured).toHaveLength(2);
    expect(captured[0]?.aliasType).toBe("owner");
    expect(captured[0]?.canonicalTarget).toBe("operator-api");
    expect(captured[1]?.aliasType).toBe("campobase");
    expect(captured[1]?.legacyPath).toBe("/api/campobase/platform");
    expect(captured[1]?.query.state).toBe("[REDACTED]");
  });

  it("does not throw if sink or logger fails", async () => {
    setLegacyAliasTelemetrySinkForTests(() => {
      throw new Error("sink-failure");
    });

    vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("logger-failure");
    });

    await expect(
      recordLegacyAliasUsageTelemetry({
        requestBindings: null,
        aliasType: "owner",
        legacyPath: "/api/owner/actions",
        canonicalTarget: "operator-api",
        method: "GET",
        correlationId: "corr-non-blocking",
        host: "drako.systems",
        hostMode: "CAMPAMENTO_BASE",
        request: buildRequestContext("https://drako.systems/api/owner/actions?cursor=1"),
        sampleRate: 1,
      }),
    ).resolves.toBeUndefined();
  });

  it("summarizes owner/campobase usage and keeps readyForCut false by default", () => {
    const summary = summarizeLegacyAliasUsage({
      events: [
        {
          eventType: "legacy.compat.route.hit",
          aliasType: "owner",
          legacyPath: "/api/owner/actions",
          canonicalTarget: "operator-api",
          method: "GET",
          timestamp: "2026-05-31T00:00:00.000Z",
          environment: "test",
          correlationId: "owner-1",
          source: "browser",
          host: "drako.systems",
          hostMode: "CAMPAMENTO_BASE",
          userAgentHash: "hash-1",
          query: { page: "1" },
          sensitiveDataRedacted: true,
        },
        {
          event: "LEGACY_COMPAT_ROUTE_HIT",
          metadata: {
            eventType: "legacy.compat.route.hit",
            aliasType: "campobase",
            legacyPath: "/api/campobase/platform",
            canonicalTarget: "operator-api",
            method: "GET",
            timestamp: "2026-05-31T01:00:00.000Z",
            environment: "test",
            correlationId: "campobase-1",
            source: "unknown",
            host: "drako.systems",
            hostMode: "CAMPAMENTO_BASE",
            userAgentHash: null,
            query: { token: "secret-token" },
            sensitiveDataRedacted: true,
          },
        },
      ],
      now: "2026-06-01T00:00:00.000Z",
    });

    expect(summary.totalHits).toBe(2);
    expect(summary.hitsByAliasType.owner).toBe(1);
    expect(summary.hitsByAliasType.campobase).toBe(1);
    expect(summary.hitsByLegacyPath["/api/owner/actions"]).toBe(1);
    expect(summary.hitsByLegacyPath["/api/campobase/platform"]).toBe(1);
    expect(summary.hitsByCanonicalTarget["operator-api"]).toBe(2);
    expect(summary.lastSeenAt).toBe("2026-05-31T01:00:00.000Z");
    expect(summary.uniqueSourcesApprox).toBe(2);
    expect(summary.sensitiveDataRedactedCount).toBe(2);
    expect(summary.unknownSourceCount).toBe(1);
    expect(summary.readyForCut).toBe(false);
    expect(summary.requiresHumanApproval).toBe(true);
  });

  it("returns NO_DATA summary when there are no valid events", () => {
    const summary = summarizeLegacyAliasUsage({
      events: [],
      now: "2026-06-01T00:00:00.000Z",
    });

    expect(summary.status).toBe("NO_DATA");
    expect(summary.totalHits).toBe(0);
    expect(summary.readyForCut).toBe(false);
    expect(summary.requiresHumanApproval).toBe(true);
  });

  it("only marks READY_FOR_CUT when complete criteria is provided", () => {
    const summary = summarizeLegacyAliasUsage({
      events: [
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
          userAgentHash: "hash-campobase",
          query: {},
          sensitiveDataRedacted: true,
        },
      ],
      now: "2026-06-01T00:00:00.000Z",
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

    expect(summary.readyForCut).toBe(true);
    expect(summary.byAlias.owner.readyForCut).toBe(true);
    expect(summary.byAlias.campobase.readyForCut).toBe(true);
    expect(summary.requiresHumanApproval).toBe(true);
  });

  it("marks NOT_READY_FOR_CUT when there are recent hits", () => {
    const summary = summarizeLegacyAliasUsage({
      events: [
        {
          eventType: "legacy.compat.route.hit",
          aliasType: "owner",
          legacyPath: "/api/owner/tasks",
          canonicalTarget: "operator-api",
          method: "GET",
          timestamp: "2026-06-01T00:00:00.000Z",
          environment: "test",
          correlationId: "owner-recent",
          source: "browser",
          host: "drako.systems",
          hostMode: "CAMPAMENTO_BASE",
          userAgentHash: "hash-owner",
          query: {},
          sensitiveDataRedacted: true,
        },
      ],
      now: "2026-06-01T00:00:00.000Z",
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

    expect(summary.readyForCut).toBe(false);
    expect(summary.byAlias.owner.blockers).toContain("RECENT_HITS_PRESENT");
    expect(summary.byAlias.owner.readyForCut).toBe(false);
  });

  it("normalizes and sanitizes raw telemetry events", () => {
    const normalized = normalizeLegacyAliasTelemetryEvents([
      {
        type: "legacy.compat.route.hit",
        aliasType: "owner",
        legacyPath: "/api/owner/actions",
        method: "get",
        timestamp: "2026-05-31T00:00:00.000Z",
        query: { access_token: "abc123", page: "2" },
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.query.access_token).toBe("[REDACTED]");
    expect(normalized[0]?.query.page).toBe("2");
    expect(JSON.stringify(normalized[0])).not.toContain("abc123");
  });
});
