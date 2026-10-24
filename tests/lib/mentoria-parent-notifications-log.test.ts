import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const run = vi.fn().mockResolvedValue({});
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    sendWhatsAppMessage: vi.fn(),
    getDb: vi.fn(() => ({ prepare })),
    prepare,
    bind,
    run,
  };
});

vi.mock("@/connectors/whatsapp/client", () => ({
  sendWhatsAppMessage: mocks.sendWhatsAppMessage,
}));

vi.mock("@/lib/mentoria/db", () => ({
  getDb: mocks.getDb,
}));

describe("sendParentSessionNotification notification log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendWhatsAppMessage.mockResolvedValue({
      success: true,
      messageId: "msg_1",
      retryCount: 0,
    });
  });

  it("writes tenant_id into mentoria_notification_log", async () => {
    const { sendParentSessionNotification } = await import("@/lib/mentoria/parent-notifications");

    await sendParentSessionNotification({
      tenantId: "tenant_123",
      sessionId: "session_123",
      studentId: "student_123",
      parentPhone: "+34600111222",
      summary: {
        parentMessage: "Resumen",
        actionItems: ["Repasar fracciones"],
      } as any,
    });

    expect(mocks.prepare).toHaveBeenCalledWith(expect.stringContaining("tenant_id"));
    expect(mocks.bind).toHaveBeenCalledWith(
      expect.any(String),
      "tenant_123",
      "session_123",
      "student_123",
      "+34600111222",
      "msg_1",
      "success",
      expect.any(String),
    );
  });
});
