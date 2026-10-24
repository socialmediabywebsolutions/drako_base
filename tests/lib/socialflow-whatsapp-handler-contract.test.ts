import { beforeEach, describe, expect, it, vi } from "vitest";

// P6: el router de WhatsApp del holding pide la respuesta a SocialCors por el contrato.

const registerHandler = vi.hoisted(() => vi.fn());
const postSocialFlowWhatsappReply = vi.hoisted(() => vi.fn());

vi.mock("@/lib/conversation-router/index", () => ({ registerHandler }));
vi.mock("@/lib/capabilities/internal-api-clients/socialflow-control-plane", () => ({ postSocialFlowWhatsappReply }));

import { registerSocialflowWhatsappHandler } from "@/lib/conversation-router/handlers/socialflow-whatsapp-handler";

type Handler = (route: { tenantId?: string; message?: string; metadata?: Record<string, unknown> }) => Promise<unknown>;

function loadHandler(): Handler {
  registerSocialflowWhatsappHandler();
  return registerHandler.mock.calls.at(-1)![1] as Handler;
}

describe("socialflow WhatsApp handler over the internal contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards the message to SocialCors and returns its reply", async () => {
    postSocialFlowWhatsappReply.mockResolvedValue({ handled: true, reply: "¡Hola!", error: null });
    const result = await loadHandler()({ tenantId: "t1", message: "Hola", metadata: { saasId: "socialflow" } });

    expect(postSocialFlowWhatsappReply).toHaveBeenCalledWith({ tenantId: "t1", saasId: "socialflow", message: "Hola" });
    expect(result).toEqual({ handled: true, handler: "socialflow", reply: "¡Hola!" });
  });

  it("reports SocialCors-side failures as not handled", async () => {
    postSocialFlowWhatsappReply.mockResolvedValue({ handled: false, reply: null, error: "AI_DOWN" });
    expect(await loadHandler()({ tenantId: "t1", message: "Hola", metadata: { saasId: "socialflow" } }))
      .toEqual({ handled: false, handler: "socialflow", reply: null, error: "AI_DOWN" });
  });

  it("reports contract/transport errors as not handled", async () => {
    postSocialFlowWhatsappReply.mockRejectedValue(new Error("INTERNAL_API_FORBIDDEN"));
    expect(await loadHandler()({ tenantId: "t1", message: "Hola", metadata: { saasId: "socialflow" } }))
      .toMatchObject({ handled: false, error: "INTERNAL_API_FORBIDDEN" });
  });

  it("does not call SocialCors without saasId", async () => {
    expect(await loadHandler()({ tenantId: "t1", message: "Hola", metadata: {} }))
      .toMatchObject({ handled: false, error: "MISSING_SAAS_ID" });
    expect(postSocialFlowWhatsappReply).not.toHaveBeenCalled();
  });
});
