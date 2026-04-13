import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  routeConversation: vi.fn(),
  registerCampamentoBaseWhatsappHandler: vi.fn(),
  registerMentoriaWhatsappHandler: vi.fn(),
  findWhatsappIdentityByPhoneAndLineGlobal: vi.fn(),
  resolvePlatformTypeFromSaasId: vi.fn(),
}));

vi.mock("@/lib/conversation-router", () => ({
  routeConversation: mocks.routeConversation,
}));

vi.mock("@/lib/conversation-router/handlers", () => ({
  registerCampamentoBaseWhatsappHandler: mocks.registerCampamentoBaseWhatsappHandler,
  registerMentoriaWhatsappHandler: mocks.registerMentoriaWhatsappHandler,
}));

vi.mock("@/lib/whatsapp/repository", () => ({
  findWhatsappIdentityByPhoneAndLineGlobal: mocks.findWhatsappIdentityByPhoneAndLineGlobal,
}));

vi.mock("@/lib/saas/resolve-platform-type", () => ({
  PlatformTypeResolutionError: class extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
  resolvePlatformTypeFromSaasId: mocks.resolvePlatformTypeFromSaasId,
}));

import { POST } from "@/app/api/conversation-router/route";

describe("/api/conversation-router WhatsApp identity resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DRAKO_ROUTER_SECRET = "router-secret";

    mocks.resolvePlatformTypeFromSaasId.mockResolvedValue("mentoria");
    mocks.routeConversation.mockResolvedValue({
      handled: true,
      handler: "mentoria.whatsapp",
      reply: "ok",
      intent: "MENTORIA_GUARDIAN_SUMMARY",
    });
  });

  it("uses phone + line hints when resolving inbound WhatsApp identity", async () => {
    mocks.findWhatsappIdentityByPhoneAndLineGlobal.mockResolvedValue({
      id: "id-a",
      tenantId: "tenant-a",
      saasId: "saas-a",
      actorType: "CUSTOMER",
      actorId: "student-1",
      phoneNumber: "+573001112233",
      preferredLanguage: null,
      allowedChannels: null,
      consentFlags: null,
      metadata: null,
      createdAt: "2026-04-13T12:00:00.000Z",
      updatedAt: "2026-04-13T12:00:00.000Z",
    });

    const response = await POST(
      new Request("https://drako.systems/api/conversation-router", {
        method: "POST",
        headers: {
          Authorization: "Bearer router-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: "whatsapp",
          senderId: "+573001112233",
          message: "hola",
          metadata: {
            messageId: "wamid.1",
            phoneNumberId: "line-123",
            displayPhoneNumber: "573005556677",
          },
        }),
      }) as any,
    );

    expect(response.status).toBe(200);
    expect(mocks.findWhatsappIdentityByPhoneAndLineGlobal).toHaveBeenCalledWith({
      phoneNumber: "+573001112233",
      phoneNumberId: "line-123",
      displayPhoneNumber: "573005556677",
    });
  });

  it("returns UNKNOWN_SENDER when global phone is ambiguous and line does not disambiguate", async () => {
    mocks.findWhatsappIdentityByPhoneAndLineGlobal.mockResolvedValue(null);

    const response = await POST(
      new Request("https://drako.systems/api/conversation-router", {
        method: "POST",
        headers: {
          Authorization: "Bearer router-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: "whatsapp",
          senderId: "+573001112233",
          message: "hola",
          metadata: {
            messageId: "wamid.1",
            phoneNumberId: "line-x",
            displayPhoneNumber: "573000000000",
          },
        }),
      }) as any,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "UNKNOWN_SENDER",
      senderId: "+573001112233",
    });
  });
});
