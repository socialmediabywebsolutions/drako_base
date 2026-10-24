import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractSessionFromRequest: vi.fn(),
  authorizeSaasAccess: vi.fn(),
  queryOne: vi.fn(),
}));

vi.mock("@/lib/edge-auth", () => ({
  extractSessionFromRequest: mocks.extractSessionFromRequest,
}));

vi.mock("@/lib/authz/saas-access", () => ({
  authorizeSaasAccess: mocks.authorizeSaasAccess,
}));

vi.mock("@/lib/db", () => ({
  queryOne: mocks.queryOne,
}));

import { GET } from "@/app/api/owner/saas-factory/jobs/[jobId]/route";

describe("/api/owner/saas-factory/jobs/[jobId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractSessionFromRequest.mockResolvedValue({
      tenantId: "tenant_a",
      role: "admin",
    });
    mocks.authorizeSaasAccess.mockResolvedValue({ authorized: true });
    mocks.queryOne.mockResolvedValue({
      job_id: "job_123",
      entity_id: "saas_1",
      correlation_id: "corr_job_1",
      idempotency_key: "create_saas:tenant_a:demo:hash",
      current_state: "RUNNING",
      execution_lock: 1,
      lock_owner: "worker_1",
      retry_count: 0,
      max_retries: 3,
      last_error: null,
      step_history_json: JSON.stringify([
        {
          step: "TRANSITION_CREATED_TO_RUNNING",
          state: "RUNNING",
          status: "SUCCESS",
          timestamp: "2026-03-05T10:00:00.000Z",
          details: "worker picked job",
        },
      ]),
      rollback_history_json: null,
      created_at: "2026-03-05T10:00:00.000Z",
      updated_at: "2026-03-05T10:01:00.000Z",
    });
  });

  it("returns 401 when session is missing", async () => {
    mocks.extractSessionFromRequest.mockResolvedValue(null);

    const response = await GET(
      new Request("https://drako.systems/api/owner/saas-factory/jobs/job_1") as any,
      { params: Promise.resolve({ jobId: "job_123" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.queryOne).not.toHaveBeenCalled();
  });

  it("returns canonical LOCKED state and timeline for owner tenant", async () => {
    const response = await GET(
      new Request("https://drako.systems/api/owner/saas-factory/jobs/job_123") as any,
      { params: Promise.resolve({ jobId: "job_123" }) },
    );

    expect(response.status).toBe(200);
    const payload = await response.json() as {
      ok: boolean;
      correlationId: string;
      job: {
        state: string;
        rawState: string;
        lock: { active: boolean };
        timeline: Array<{ step: string; state: string; status: string }>;
      };
    };

    expect(payload.ok).toBe(true);
    expect(payload.correlationId).toBe("corr_job_1");
    expect(payload.job.state).toBe("LOCKED");
    expect(payload.job.rawState).toBe("RUNNING");
    expect(payload.job.lock.active).toBe(true);
    expect(payload.job.timeline).toHaveLength(1);
    expect(payload.job.timeline[0]).toMatchObject({
      step: "TRANSITION_CREATED_TO_RUNNING",
      state: "RUNNING",
      status: "SUCCESS",
    });
    expect(mocks.queryOne).toHaveBeenCalledWith(expect.stringContaining("WHERE job_id = ?"), "job_123", "tenant_a");
  });

  it("returns 404 when job does not belong to tenant", async () => {
    mocks.queryOne.mockResolvedValue(null);

    const response = await GET(
      new Request("https://drako.systems/api/owner/saas-factory/jobs/job_x") as any,
      { params: Promise.resolve({ jobId: "job_xyz" }) },
    );

    expect(response.status).toBe(404);
  });
});
