import { beforeEach, describe, expect, it, vi } from "vitest";

const registerIntegrationDefinition = vi.hoisted(() => vi.fn());
const registerIntegrationProvider = vi.hoisted(() => vi.fn());
const resolveWhatsappContext = vi.hoisted(() => vi.fn());
const getWhatsappIdentityByPhone = vi.hoisted(() => vi.fn());
const recordWhatsappMessage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/integration-core/definitions", () => ({
  registerIntegrationDefinition,
}));

vi.mock("@/lib/integration-core/providers", async () => {
  const actual = await vi.importActual<typeof import("@/lib/integration-core/providers")>("@/lib/integration-core/providers");
  return {
    ...actual,
    registerIntegrationProvider,
  };
});

vi.mock("@/lib/whatsapp/repository", () => ({
  resolveWhatsappContext,
  getWhatsappIdentityByPhone,
  recordWhatsappMessage,
}));

describe("whatsapp integration provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    resolveWhatsappContext.mockResolvedValue({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      mode: "demo",
    });
    getWhatsappIdentityByPhone.mockResolvedValue({
      id: "wa_identity_1",
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      actorType: "SAAS_OWNER",
      actorId: "owner_1",
      phoneNumber: "+34600000001",
      preferredLanguage: "es",
      allowedChannels: ["whatsapp"],
      consentFlags: ["marketing"],
      metadata: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    recordWhatsappMessage.mockResolvedValue({
      id: "wa_msg_1",
      phoneNumber: "+34611111111",
      status: "SENT",
    });
  });

  it("registers the whatsapp definition and provider", async () => {
    const { ensureWhatsappIntegrationAvailable } = await import("@/lib/integration-core/providers/whatsapp");
    await ensureWhatsappIntegrationAvailable();

    expect(registerIntegrationDefinition).toHaveBeenCalledWith(expect.objectContaining({
      integrationKey: "whatsapp",
      supportedOperations: ["send_message"],
    }));
    expect(registerIntegrationProvider).toHaveBeenCalledWith(
      "whatsapp",
      expect.objectContaining({
        validate: expect.any(Function),
        executeOperation: expect.any(Function),
      }),
    );
  });

  it("validates a connected whatsapp identity", async () => {
    const { ensureWhatsappIntegrationAvailable } = await import("@/lib/integration-core/providers/whatsapp");
    await ensureWhatsappIntegrationAvailable();
    const provider = registerIntegrationProvider.mock.calls[0][1] as {
      validate: Function;
      executeOperation: Function;
    };

    const result = await provider.validate({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      integrationKey: "whatsapp",
      connection: {
        tenantId: "tenant_clinic",
        saasId: "saas_clinic",
        integrationKey: "whatsapp",
        credentials: {
          phoneNumber: "+34600000001",
        },
        metadata: null,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("CONNECTED");
    expect(result.metadata?.phoneNumber).toBe("+34600000001");
  });

  it("returns INVALID when the configured identity is missing", async () => {
    getWhatsappIdentityByPhone.mockResolvedValue(null);

    const { ensureWhatsappIntegrationAvailable } = await import("@/lib/integration-core/providers/whatsapp");
    await ensureWhatsappIntegrationAvailable();
    const provider = registerIntegrationProvider.mock.calls[0][1] as {
      validate: Function;
    };

    const result = await provider.validate({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      integrationKey: "whatsapp",
      connection: {
        tenantId: "tenant_clinic",
        saasId: "saas_clinic",
        integrationKey: "whatsapp",
        credentials: {
          phoneNumber: "+34600000001",
        },
        metadata: null,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("INVALID");
    expect(result.error?.code).toBe("WHATSAPP_IDENTITY_NOT_FOUND");
  });

  it("executes send_message successfully", async () => {
    const { ensureWhatsappIntegrationAvailable } = await import("@/lib/integration-core/providers/whatsapp");
    await ensureWhatsappIntegrationAvailable();
    const provider = registerIntegrationProvider.mock.calls[0][1] as {
      executeOperation: Function;
    };

    const result = await provider.executeOperation({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      integrationKey: "whatsapp",
      operationKey: "send_message",
      payload: {
        to: "+34611111111",
        body: "Recordatorio de cita",
      },
      connection: {
        tenantId: "tenant_clinic",
        saasId: "saas_clinic",
        integrationKey: "whatsapp",
        credentials: {
          phoneNumber: "+34600000001",
        },
        metadata: null,
      },
    });

    expect(result.ok).toBe(true);
    expect(recordWhatsappMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        phoneNumber: "+34611111111",
        body: "Recordatorio de cita",
        status: "SENT",
      }),
    );
    expect(result.result?.messageId).toBe("wa_msg_1");
  });

  it("rejects send_message when payload is invalid", async () => {
    const { ensureWhatsappIntegrationAvailable } = await import("@/lib/integration-core/providers/whatsapp");
    await ensureWhatsappIntegrationAvailable();
    const provider = registerIntegrationProvider.mock.calls[0][1] as {
      executeOperation: Function;
    };

    const result = await provider.executeOperation({
      tenantId: "tenant_clinic",
      saasId: "saas_clinic",
      integrationKey: "whatsapp",
      operationKey: "send_message",
      payload: {
        to: "",
        body: "",
      },
      connection: {
        tenantId: "tenant_clinic",
        saasId: "saas_clinic",
        integrationKey: "whatsapp",
        credentials: {
          phoneNumber: "+34600000001",
        },
        metadata: null,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("WHATSAPP_MESSAGE_TO_REQUIRED");
  });
});
