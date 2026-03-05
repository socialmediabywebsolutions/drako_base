import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  recordCampamentoEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  run: mocks.run,
}));

vi.mock("@/lib/empire/events", () => ({
  recordCampamentoEvent: mocks.recordCampamentoEvent,
}));

import { recordCampamentoEventSafe } from "@/lib/empire/events-safe";

describe("recordCampamentoEventSafe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to persistence + metric and does not throw when primary write fails", async () => {
    mocks.recordCampamentoEvent.mockRejectedValue(new Error("primary write timeout"));
    mocks.run.mockResolvedValue(true);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await recordCampamentoEventSafe({
      tenantId: "tenant_a",
      saasId: "saas_1",
      type: "provision.saas_factory.domains.succeeded",
      severity: "INFO",
      source: "PROVISIONING_CONSUMER",
      message: "Domains step completed",
      correlationId: "corr_1",
      jobId: "job_1",
      step: "domains",
    });

    expect(result).toEqual({ ok: true, mode: "fallback" });
    expect(mocks.run).toHaveBeenCalled();
    const sqlCalls = mocks.run.mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes("campamento_event_fallbacks"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("campamento_observability_metrics"))).toBe(true);

    const structuredPrimaryErrorLog = errorSpy.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes("CAMPAMENTO_EVENT_WRITE_FAILED"));
    expect(structuredPrimaryErrorLog).toBeTruthy();

    const parsed = JSON.parse(structuredPrimaryErrorLog as string) as {
      code: string;
      correlationId: string;
      tenantId: string;
      jobId: string;
      step: string;
    };
    expect(parsed.code).toBe("CAMPAMENTO_EVENT_WRITE_FAILED");
    expect(parsed.correlationId).toBe("corr_1");
    expect(parsed.tenantId).toBe("tenant_a");
    expect(parsed.jobId).toBe("job_1");
    expect(parsed.step).toBe("domains");

    errorSpy.mockRestore();
  });

  it("returns fallback failure without throw when fallback schema is missing", async () => {
    mocks.recordCampamentoEvent.mockRejectedValue(new Error("primary write timeout"));
    mocks.run.mockRejectedValue(new Error("no such table: campamento_event_fallbacks"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await recordCampamentoEventSafe({
      tenantId: "tenant_a",
      saasId: "saas_1",
      type: "provision.saas_factory.stripe.succeeded",
      severity: "INFO",
      source: "PROVISIONING_CONSUMER",
      message: "Stripe step completed",
      correlationId: "corr_schema_missing",
      jobId: "job_schema_missing",
      step: "stripe",
    });

    expect(result).toEqual({ ok: false, mode: "fallback" });

    const schemaMissingLog = errorSpy.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes("CAMPAMENTO_EVENT_FALLBACK_SCHEMA_MISSING"));

    expect(schemaMissingLog).toBeTruthy();
    const parsed = JSON.parse(schemaMissingLog as string) as {
      code: string;
      correlationId: string;
      jobId: string;
      step: string;
    };
    expect(parsed.code).toBe("CAMPAMENTO_EVENT_FALLBACK_SCHEMA_MISSING");
    expect(parsed.correlationId).toBe("corr_schema_missing");
    expect(parsed.jobId).toBe("job_schema_missing");
    expect(parsed.step).toBe("stripe");

    errorSpy.mockRestore();
  });
});
