import { beforeEach, describe, expect, it, vi } from "vitest";

const listSaasPlatformBootstraps = vi.hoisted(() => vi.fn());
const recordObservabilityActivity = vi.hoisted(() => vi.fn());
const openObservabilityIncident = vi.hoisted(() => vi.fn());
const resolveObservabilityIncidentsByScope = vi.hoisted(() => vi.fn());

vi.mock("@/lib/saas-contract", () => ({
  listSaasPlatformBootstraps,
}));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
  openObservabilityIncident,
  resolveObservabilityIncidentsByScope,
}));

describe("execution signal bus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordObservabilityActivity.mockResolvedValue(undefined);
    openObservabilityIncident.mockResolvedValue(undefined);
    resolveObservabilityIncidentsByScope.mockResolvedValue(undefined);
  });

  it("routes one signal to multiple registered SaaS handlers", async () => {
    const clinicHandler = vi.fn().mockResolvedValue(undefined);
    const taskOpsHandler = vi.fn().mockResolvedValue(undefined);
    listSaasPlatformBootstraps.mockReturnValue([
      {
        saasId: "clinic",
        connect: vi.fn(),
        signalHandlers: { "lead.created": clinicHandler },
      },
      {
        saasId: "taskops",
        connect: vi.fn(),
        signalHandlers: { "lead.created": taskOpsHandler },
      },
    ]);

    const { emitSignal } = await import("@/lib/execution/signal-bus");
    const signal = await emitSignal({
      type: "lead.created",
      sourceSaasId: "socialflow",
      sourceTenantId: "tenant_alpha",
      payload: { leadId: "lead_1" },
    });

    expect(signal.type).toBe("lead.created");
    expect(clinicHandler).toHaveBeenCalledTimes(1);
    expect(taskOpsHandler).toHaveBeenCalledTimes(1);
    expect(clinicHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        targetTenantId: "tenant_alpha",
        targetSaasId: "clinic",
        signal: expect.objectContaining({
          type: "lead.created",
          sourceSaasId: "socialflow",
        }),
      }),
    );
    expect(recordObservabilityActivity).toHaveBeenCalledTimes(3);
    expect(openObservabilityIncident).not.toHaveBeenCalled();
  });

  it("records incident and error activity when a handler fails", async () => {
    listSaasPlatformBootstraps.mockReturnValue([
      {
        saasId: "clinic",
        connect: vi.fn(),
        signalHandlers: {
          "task.overdue": vi.fn().mockRejectedValue(new Error("handler exploded")),
        },
      },
    ]);

    const { emitSignal } = await import("@/lib/execution/signal-bus");
    await emitSignal({
      type: "task.overdue",
      sourceSaasId: "taskops",
      sourceTenantId: "tenant_alpha",
      payload: { taskId: "task_1" },
    });

    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "clinic",
        activityType: "signal_handled",
        status: "error",
      }),
    );
    expect(openObservabilityIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant_alpha",
        saasId: "clinic",
        incidentType: "signal_handler_failed",
      }),
    );
    expect(resolveObservabilityIncidentsByScope).not.toHaveBeenCalled();
  });

  it("dedupes a signal when the same signalId is emitted twice", async () => {
    const clinicHandler = vi.fn().mockResolvedValue(undefined);
    listSaasPlatformBootstraps.mockReturnValue([
      {
        saasId: "clinic",
        connect: vi.fn(),
        signalHandlers: { "lead.created": clinicHandler },
      },
    ]);

    const { emitSignal } = await import("@/lib/execution/signal-bus");
    await emitSignal({
      signalId: "signal_dedupe_1",
      type: "lead.created",
      sourceSaasId: "socialflow",
      sourceTenantId: "tenant_alpha",
    });
    await emitSignal({
      signalId: "signal_dedupe_1",
      type: "lead.created",
      sourceSaasId: "socialflow",
      sourceTenantId: "tenant_alpha",
    });

    expect(clinicHandler).toHaveBeenCalledTimes(1);
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "socialflow",
        activityType: "signal_deduped",
        status: "warning",
      }),
    );
  });

  it("drops signals that exceed the chaining depth limit", async () => {
    const clinicHandler = vi.fn().mockResolvedValue(undefined);
    listSaasPlatformBootstraps.mockReturnValue([
      {
        saasId: "clinic",
        connect: vi.fn(),
        signalHandlers: { "lead.created": clinicHandler },
      },
    ]);

    const { emitSignal } = await import("@/lib/execution/signal-bus");
    await emitSignal({
      signalId: "signal_loop_1",
      type: "lead.created",
      sourceSaasId: "socialflow",
      sourceTenantId: "tenant_alpha",
      chainDepth: 5,
    });

    expect(clinicHandler).not.toHaveBeenCalled();
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "socialflow",
        activityType: "signal_dropped",
        status: "warning",
      }),
    );
    expect(openObservabilityIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "socialflow",
        incidentType: "signal_handler_failed",
      }),
    );
  });

  it("isolates one failing handler without breaking other handlers", async () => {
    const successfulHandler = vi.fn().mockResolvedValue(undefined);
    listSaasPlatformBootstraps.mockReturnValue([
      {
        saasId: "clinic",
        connect: vi.fn(),
        signalHandlers: {
          "task.overdue": vi.fn().mockRejectedValue(new Error("handler exploded")),
        },
      },
      {
        saasId: "taskops",
        connect: vi.fn(),
        signalHandlers: {
          "task.overdue": successfulHandler,
        },
      },
    ]);

    const { emitSignal } = await import("@/lib/execution/signal-bus");
    await emitSignal({
      signalId: "signal_isolated_1",
      type: "task.overdue",
      sourceSaasId: "taskops",
      sourceTenantId: "tenant_alpha",
    });

    expect(successfulHandler).toHaveBeenCalledTimes(1);
    expect(openObservabilityIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "clinic",
      }),
    );
  });

  it("isolates an invalid handler definition without breaking the bus", async () => {
    const successfulHandler = vi.fn().mockResolvedValue(undefined);
    listSaasPlatformBootstraps.mockReturnValue([
      {
        saasId: "clinic",
        connect: vi.fn(),
        signalHandlers: {
          "task.overdue": "not-a-function",
        },
      },
      {
        saasId: "taskops",
        connect: vi.fn(),
        signalHandlers: {
          "task.overdue": successfulHandler,
        },
      },
    ]);

    const { emitSignal } = await import("@/lib/execution/signal-bus");
    await emitSignal({
      signalId: "signal_invalid_handler_1",
      type: "task.overdue",
      sourceSaasId: "taskops",
      sourceTenantId: "tenant_alpha",
    });

    expect(successfulHandler).toHaveBeenCalledTimes(1);
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "clinic",
        activityType: "signal_handled",
        status: "error",
      }),
    );
  });

  it("supports simple chaining between SaaS handlers", async () => {
    const downstreamHandler = vi.fn().mockResolvedValue(undefined);
    listSaasPlatformBootstraps.mockReturnValue([
      {
        saasId: "clinic",
        connect: vi.fn(),
        signalHandlers: {
          "lead.created": async ({ signal }) => {
            const { emitSignal } = await import("@/lib/execution/signal-bus");
            await emitSignal({
              type: "appointment.created",
              sourceSaasId: "clinic",
              sourceTenantId: signal.sourceTenantId,
              correlationId: signal.signalId,
              payload: { appointmentId: "appt_1" },
            });
          },
        },
      },
      {
        saasId: "taskops",
        connect: vi.fn(),
        signalHandlers: {
          "appointment.created": downstreamHandler,
        },
      },
    ]);

    const { emitSignal } = await import("@/lib/execution/signal-bus");
    await emitSignal({
      type: "lead.created",
      sourceSaasId: "socialflow",
      sourceTenantId: "tenant_alpha",
      payload: { leadId: "lead_1" },
    });

    expect(downstreamHandler).toHaveBeenCalledTimes(1);
    expect(downstreamHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        targetTenantId: "tenant_alpha",
        targetSaasId: "taskops",
        signal: expect.objectContaining({
          type: "appointment.created",
          sourceSaasId: "clinic",
          correlationId: expect.any(String),
          chainDepth: 1,
        }),
      }),
    );
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "socialflow",
        activityType: "signal_emitted",
      }),
    );
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "clinic",
        activityType: "signal_emitted",
      }),
    );
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        saasId: "taskops",
        activityType: "signal_handled",
        metadata: expect.objectContaining({
          correlationId: expect.any(String),
          originSignalId: expect.any(String),
        }),
      }),
    );
  });
});
