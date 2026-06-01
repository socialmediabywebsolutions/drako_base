import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildLegacyAliasTelemetryEvent,
  recordLegacyAliasUsageTelemetry,
  sanitizeLegacyAliasQueryParams,
  setLegacyAliasTelemetrySinkForTests,
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
});
