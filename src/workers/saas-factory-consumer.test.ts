import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setGlobalEnv: vi.fn(),
  run: vi.fn(),
}));

vi.mock("@/lib/cf", () => ({
  setGlobalEnv: mocks.setGlobalEnv,
}));

vi.mock("@/lib/db", () => ({
  run: mocks.run,
}));

import worker from "@/workers/saas-factory-consumer";

describe("legacy saas factory queue worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue(true);
  });

  it("blocks legacy queue messages and only audits + ack", async () => {
    const message = {
      id: "msg_1",
      body: {
        correlationId: "corr_legacy_1",
        saasSlug: "legacy-saas",
      },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    await worker.queue(
      { messages: [message] } as unknown as MessageBatch<{ correlationId: string; saasSlug: string }>,
      { SAAS_FACTORY_QUEUE: { send: vi.fn() } } as any,
    );

    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.run.mock.calls[0][3]).toBe("legacy.saas_factory_queue.blocked");
    expect(message.ack).toHaveBeenCalledTimes(1);
    expect(message.retry).not.toHaveBeenCalled();
  });
});
