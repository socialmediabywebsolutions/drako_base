import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquireLock: vi.fn(),
  queryOne: vi.fn(),
  provisionSaaS: vi.fn(),
}));

vi.mock("../../../src/lib/provisioning/job-runner", () => ({
  JobRunner: {
    acquireLock: mocks.acquireLock,
  },
  JobLockedError: class JobLockedError extends Error {},
}));

vi.mock("../../../src/lib/db", () => ({
  queryOne: mocks.queryOne,
}));

vi.mock("../../../src/lib/campamento-base/saas-factory-orchestrator", () => ({
  provisionSaaS: mocks.provisionSaaS,
}));

import { processQueueBatch } from "./consumer";

type QueueMsg = {
  body: { jobId: string; type: string; correlationId: string; tenantId?: string };
  id: string;
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
};

describe("drako scheduler provisioning consumer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.acquireLock.mockResolvedValue({ lockVersion: 7 });
    mocks.queryOne.mockResolvedValue({
      payload_json: JSON.stringify({ proposedSlug: "test-saas", saasName: "Test SaaS" }),
      tenant_id: "tenant_a",
      current_state: "CREATED",
      entity_id: "saas_1",
      correlation_id: "corr_job_1",
      idempotency_key: "create_saas:tenant_a:test-saas",
    });
    mocks.provisionSaaS.mockResolvedValue({ saasId: "saas_1", status: "SUCCESS" });
  });

  it("passes existing job context to avoid nested job creation", async () => {
    const message: QueueMsg = {
      id: "msg_1",
      body: { jobId: "job_1", type: "SAAS_PROVISIONING", correlationId: "corr_job_1", tenantId: "tenant_a" },
      ack: vi.fn(),
      retry: vi.fn(),
    };

    const batch = { messages: [message] } as unknown as MessageBatch<{ jobId: string; type: string; correlationId: string }>;

    await processQueueBatch(batch, { DRACO_DB: {} as D1Database, RATE_LIMITER: {} as DurableObjectNamespace });

    expect(mocks.provisionSaaS).toHaveBeenCalledTimes(1);
    expect(mocks.provisionSaaS).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerTenantId: "tenant_a",
        preAcquiredToken: expect.objectContaining({ lockVersion: 7 }),
        existingJob: expect.objectContaining({
          jobId: "job_1",
          state: "CREATED",
          entityId: "saas_1",
          correlationId: "corr_job_1",
          idempotencyKey: "create_saas:tenant_a:test-saas",
        }),
      }),
    );
    expect(message.ack).toHaveBeenCalledTimes(1);
  });
});
