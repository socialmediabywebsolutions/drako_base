import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listFactorySaas = vi.hoisted(() => vi.fn());
const listObservabilityActivities = vi.hoisted(() => vi.fn());
const recordObservabilityActivity = vi.hoisted(() => vi.fn());
const resolveWhatsappContext = vi.hoisted(() => vi.fn());
const listWhatsappIdentities = vi.hoisted(() => vi.fn());
const sendMessage = vi.hoisted(() => vi.fn());
const env = vi.hoisted(() => vi.fn());

vi.mock("@/lib/factory/registry", () => ({
  listFactorySaas,
}));

vi.mock("@/lib/observability-core", () => ({
  listObservabilityActivities,
  recordObservabilityActivity,
}));

vi.mock("@/lib/whatsapp/repository", () => ({
  resolveWhatsappContext,
  listWhatsappIdentities,
}));

vi.mock("@/lib/cf", () => ({
  env,
}));

vi.mock("@/lib/notifications/whatsapp-service", () => ({
  WhatsAppService: class {
    constructor(_config: unknown) {}

    sendMessage = sendMessage;
  },
}));

import {
  sendOperatorDailyWhatsappSummary,
  sendOperatorRealtimeWhatsappAlert,
} from "@/lib/campamento-base/operator-whatsapp-notifications";

type Activity = {
  id: string;
  tenantId: string;
  saasId: string;
  sourceType: "saas" | "integration";
  sourceKey: string;
  activityType: string;
  status: "info" | "success" | "warning" | "error";
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

const factorySaas = [
  {
    saasId: "runtime_alpha",
    displayName: "Runtime Alpha",
    supportsOperatorSurface: true,
    metadata: { operatorTenantId: "tenant_owner" },
    status: "ACTIVE",
  },
  {
    saasId: "runtime_beta",
    displayName: "Runtime Beta",
    supportsOperatorSurface: true,
    metadata: { operatorTenantId: "tenant_owner" },
    status: "ACTIVE",
  },
] as const;

const ownerIdentity = {
  id: "identity_owner",
  tenantId: "tenant_owner",
  saasId: "campamento-base",
  actorType: "PLATFORM_OWNER",
  actorId: "owner_1",
  phoneNumber: "+34600000001",
  preferredLanguage: null,
  allowedChannels: null,
  consentFlags: null,
  metadata: null,
  createdAt: "2026-04-12T08:00:00.000Z",
  updatedAt: "2026-04-12T08:00:00.000Z",
};

function buildActivity(input: Partial<Activity> & Pick<Activity, "id" | "saasId" | "activityType" | "status" | "summary" | "createdAt">): Activity {
  return {
    tenantId: "tenant_owner",
    sourceType: "saas",
    sourceKey: input.saasId,
    metadata: null,
    ...input,
  };
}

describe("campamento-base operator whatsapp outbound", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T10:10:00.000Z"));

    vi.clearAllMocks();
    env.mockReturnValue({});
    listFactorySaas.mockResolvedValue(factorySaas);
    resolveWhatsappContext.mockResolvedValue({ tenantId: "tenant_owner", saasId: "campamento-base" });
    listWhatsappIdentities.mockResolvedValue([ownerIdentity]);
    sendMessage.mockResolvedValue({ messageId: "msg_1", status: "queued" });
    recordObservabilityActivity.mockResolvedValue({ id: "activity_1" });
    listObservabilityActivities.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("construye y envia el resumen diario consolidado", async () => {
    listObservabilityActivities.mockImplementation(async (filters?: { saasId?: string; sourceKey?: string }) => {
      if (filters?.saasId === "runtime_alpha") {
        return [
          buildActivity({
            id: "a_1",
            saasId: "runtime_alpha",
            activityType: "signal_latency_spike",
            status: "warning",
            summary: "Latency spike",
            createdAt: "2026-04-12T10:05:00.000Z",
          }),
          buildActivity({
            id: "a_2",
            saasId: "runtime_alpha",
            activityType: "job_failed",
            status: "error",
            summary: "Nightly sync failed",
            createdAt: "2026-04-12T09:40:00.000Z",
          }),
        ];
      }

      if (filters?.saasId === "runtime_beta") {
        return [
          buildActivity({
            id: "b_1",
            saasId: "runtime_beta",
            activityType: "daily_health_ok",
            status: "success",
            summary: "All good",
            createdAt: "2026-04-12T09:50:00.000Z",
          }),
        ];
      }

      return [];
    });

    const result = await sendOperatorDailyWhatsappSummary({ operatorTenantId: "tenant_owner" });

    expect(result.sent).toBe(true);
    expect(result.saasCount).toBe(2);
    expect(result.errorsCount).toBe(1);
    expect(result.signalsCount).toBe(1);

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: "+34600000001",
      }),
    );
    expect(sendMessage.mock.calls[0][0].body).toContain("Runtime Alpha");
    expect(sendMessage.mock.calls[0][0].body).toContain("errores=1");
    expect(sendMessage.mock.calls[0][0].body).toContain("senales=1");

    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "operator_whatsapp_daily_summary_sent",
        sourceKey: "campamento-base.operator-whatsapp",
      }),
    );
  });

  it("envia alerta realtime para la ultima actividad relevante", async () => {
    listFactorySaas.mockResolvedValue([factorySaas[0]]);

    listObservabilityActivities.mockImplementation(async (filters?: { saasId?: string; sourceKey?: string }) => {
      if (filters?.sourceKey === "campamento-base.operator-whatsapp") {
        return [];
      }

      if (filters?.saasId === "runtime_alpha") {
        return [
          buildActivity({
            id: "rt_1",
            saasId: "runtime_alpha",
            activityType: "signal_payment_stall",
            status: "warning",
            summary: "Payment queue stalled",
            createdAt: "2026-04-12T10:06:00.000Z",
          }),
          buildActivity({
            id: "rt_2",
            saasId: "runtime_alpha",
            activityType: "background_ok",
            status: "success",
            summary: "Background healthy",
            createdAt: "2026-04-12T10:03:00.000Z",
          }),
        ];
      }

      return [];
    });

    const result = await sendOperatorRealtimeWhatsappAlert({
      operatorTenantId: "tenant_owner",
      saasId: "runtime_alpha",
    });

    expect(result.sent).toBe(true);
    expect(result.deduplicated).toBe(false);
    expect(result.activityType).toBe("signal_payment_stall");

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage.mock.calls[0][0].body).toContain("signal_payment_stall");

    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "operator_whatsapp_realtime_alert_sent",
      }),
    );
  });

  it("aplica deduplicacion en ventana de 15 minutos", async () => {
    listFactorySaas.mockResolvedValue([factorySaas[0]]);

    const targetActivity = buildActivity({
      id: "dup_target",
      saasId: "runtime_alpha",
      activityType: "signal_inventory_drop",
      status: "warning",
      summary: "Inventory dropped",
      createdAt: "2026-04-12T10:05:00.000Z",
    });

    listObservabilityActivities.mockImplementation(async (filters?: { saasId?: string; sourceKey?: string }) => {
      if (filters?.sourceKey === "campamento-base.operator-whatsapp" && filters?.saasId === "runtime_alpha") {
        return [
          {
            id: "already_sent",
            tenantId: "tenant_owner",
            saasId: "runtime_alpha",
            sourceType: "integration",
            sourceKey: "campamento-base.operator-whatsapp",
            activityType: "operator_whatsapp_realtime_alert_sent",
            status: "success",
            summary: "Already sent",
            metadata: {
              targetSaasId: "runtime_alpha",
              targetActivityType: "signal_inventory_drop",
              targetActivityCreatedAt: "2026-04-12T10:05:00.000Z",
            },
            createdAt: "2026-04-12T10:08:00.000Z",
          },
        ];
      }

      if (filters?.saasId === "runtime_alpha") {
        return [targetActivity];
      }

      return [];
    });

    const result = await sendOperatorRealtimeWhatsappAlert({
      operatorTenantId: "tenant_owner",
      saasId: "runtime_alpha",
    });

    expect(result.sent).toBe(false);
    expect(result.deduplicated).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("falla en modo fail-closed cuando no existe owner phone", async () => {
    listWhatsappIdentities.mockResolvedValue([
      {
        ...ownerIdentity,
        actorType: "EMPLOYEE",
      },
    ]);

    await expect(
      sendOperatorDailyWhatsappSummary({ operatorTenantId: "tenant_owner" }),
    ).rejects.toThrowError("OPERATOR_WHATSAPP_OWNER_PHONE_MISSING");

    expect(sendMessage).not.toHaveBeenCalled();
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "operator_whatsapp_owner_identity_missing",
      }),
    );
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "operator_whatsapp_daily_summary_failed",
      }),
    );
  });

  it("registra observabilidad de fallo en alerta realtime", async () => {
    listFactorySaas.mockResolvedValue([factorySaas[0]]);
    sendMessage.mockRejectedValue(new Error("WHATSAPP_DOWN"));

    listObservabilityActivities.mockImplementation(async (filters?: { saasId?: string; sourceKey?: string }) => {
      if (filters?.sourceKey === "campamento-base.operator-whatsapp") {
        return [];
      }

      if (filters?.saasId === "runtime_alpha") {
        return [
          buildActivity({
            id: "rt_fail_1",
            saasId: "runtime_alpha",
            activityType: "signal_payments_error",
            status: "error",
            summary: "Critical payment error",
            createdAt: "2026-04-12T10:04:00.000Z",
          }),
        ];
      }

      return [];
    });

    await expect(
      sendOperatorRealtimeWhatsappAlert({
        operatorTenantId: "tenant_owner",
        saasId: "runtime_alpha",
      }),
    ).rejects.toThrowError("WHATSAPP_DOWN");

    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        activityType: "operator_whatsapp_realtime_alert_failed",
        status: "error",
        sourceKey: "campamento-base.operator-whatsapp",
      }),
    );
  });
});
