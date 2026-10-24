import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDb } from "@/__tests__/setup";
import { env as resolveEnv } from "@/lib/cf";
import { setupFactoryCreateSaasOwnerMocks } from "./factory-create-saas.test-kit";
import {
  buildCreateSaasRequest,
  createFactoryRuntimeEnv,
  createProvisioningHarnessStore,
  installProvisioningDbMock,
  type ProvisioningHarnessStore,
} from "./factory-create-saas.helpers";

import { POST as createSaas } from "@/app/api/owner/saas-factory/create-saas/route";

type ErrorPayload = {
  ok: boolean;
  error: string;
};

type QueuedPayload = {
  ok: boolean;
  queued: boolean;
  jobId: string;
};

function createSaasRow(params: { tenantId: string; slug: string; index: number }) {
  return {
    id: `saas_existing_${params.index}`,
    name: `Existing ${params.index}`,
    slug: params.slug,
    status: "active",
    tenant_id: params.tenantId,
    created_at: new Date().toISOString(),
  };
}

function createActiveJob(store: ProvisioningHarnessStore, params: { tenantId: string; index: number; state: "CREATED" | "RUNNING" }) {
  const now = new Date().toISOString();
  store.provisioningJobs.push({
    job_id: `job_active_${params.index}`,
    type: "SAAS_PROVISIONING",
    entity_id: `saas_active_${params.index}`,
    correlation_id: `corr_active_${params.index}`,
    idempotency_key: `idem_active_${params.index}`,
    current_state: params.state,
    payload_json: JSON.stringify({ proposedSlug: `active-${params.index}`, saasName: `Active ${params.index}` }),
    tenant_id: params.tenantId,
    created_at: now,
    updated_at: now,
    execution_lock: params.state === "RUNNING" ? 1 : 0,
    lock_acquired_at: params.state === "RUNNING" ? now : null,
    lock_owner: params.state === "RUNNING" ? `worker_${params.index}` : null,
    lock_version: params.state === "RUNNING" ? 1 : 0,
    retry_count: 0,
    max_retries: 3,
    last_error: null,
    step_history_json: "[]",
    rollback_history_json: "[]",
  });
}

describe("factory create-saas quota enforcement", () => {
  beforeEach(() => {
    setupFactoryCreateSaasOwnerMocks();
  });

  it("returns 402 SAAS_LIMIT_REACHED when free plan already has 1 SaaS", async () => {
    const store = createProvisioningHarnessStore({ tenantPlan: "free", subscriptionPlan: "free" });
    store.saas.push(createSaasRow({ tenantId: "tenant_owner", slug: "existing-free", index: 1 }));
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });

    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);

    const response = await createSaas(buildCreateSaasRequest({ slug: "quota-free-blocked" }) as any);
    expect(response.status).toBe(402);

    const payload = await response.json() as ErrorPayload;
    expect(payload).toEqual({ ok: false, error: "SAAS_LIMIT_REACHED" });
    expect(store.sentQueueMessages).toHaveLength(0);
    expect(store.provisioningJobs).toHaveLength(0);
  });

  it("returns 409 FACTORY_CONCURRENCY_LIMIT when pro plan already has 3 active jobs", async () => {
    const store = createProvisioningHarnessStore({ tenantPlan: "pro", subscriptionPlan: "pro" });
    createActiveJob(store, { tenantId: "tenant_owner", index: 1, state: "RUNNING" });
    createActiveJob(store, { tenantId: "tenant_owner", index: 2, state: "RUNNING" });
    createActiveJob(store, { tenantId: "tenant_owner", index: 3, state: "CREATED" });
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });

    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);

    const response = await createSaas(buildCreateSaasRequest({ slug: "quota-concurrency-blocked" }) as any);
    expect(response.status).toBe(409);

    const payload = await response.json() as ErrorPayload;
    expect(payload).toEqual({ ok: false, error: "FACTORY_CONCURRENCY_LIMIT" });
    expect(store.sentQueueMessages).toHaveLength(0);
    expect(store.provisioningJobs).toHaveLength(3);
  });

  it("does not infer factory plan from a newer unrelated tenant subscription", async () => {
    const store = createProvisioningHarnessStore({ tenantPlan: "free", subscriptionPlan: "free", workspaces: 1 });
    store.saas.push(createSaasRow({ tenantId: "tenant_owner", slug: "existing-free", index: 1 }));
    store.saasSubscriptions.push({
      id: "tenant_owner:socialflow",
      tenant_id: "tenant_owner",
      saas_slug: "socialflow",
      stripe_customer_id: "cus_other",
      stripe_subscription_id: "sub_other",
      stripe_price_id: "price_other",
      plan_code: "enterprise",
      status: "active",
      current_period_end: new Date().toISOString(),
      cancel_at_period_end: 0,
      updated_at: new Date(Date.now() + 60_000).toISOString(),
    });
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });

    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);

    const response = await createSaas(buildCreateSaasRequest({ slug: "quota-ambiguous-subscription" }) as any);
    expect(response.status).toBe(402);

    const payload = await response.json() as ErrorPayload;
    expect(payload).toEqual({ ok: false, error: "SAAS_LIMIT_REACHED" });
    expect(store.sentQueueMessages).toHaveLength(0);
    expect(store.provisioningJobs).toHaveLength(0);
  });

  it("returns 402 PLAN_INACTIVE when the subscription is not active", async () => {
    const store = createProvisioningHarnessStore({ tenantPlan: "pro", subscriptionPlan: "pro", subscriptionStatus: "canceled" });
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });

    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);

    const response = await createSaas(buildCreateSaasRequest({ slug: "quota-plan-inactive" }) as any);
    expect(response.status).toBe(402);

    const payload = await response.json() as ErrorPayload;
    expect(payload).toEqual({ ok: false, error: "PLAN_INACTIVE" });
    expect(store.sentQueueMessages).toHaveLength(0);
  });

  it("returns 202 and queues the job when usage is within plan", async () => {
    const store = createProvisioningHarnessStore({ tenantPlan: "pro", subscriptionPlan: "pro" });
    store.saas.push(createSaasRow({ tenantId: "tenant_owner", slug: "existing-pro-1", index: 1 }));
    store.saas.push(createSaasRow({ tenantId: "tenant_owner", slug: "existing-pro-2", index: 2 }));
    const runtimeEnv = createFactoryRuntimeEnv({ db: mockDb, store });

    vi.mocked(resolveEnv).mockReturnValue(runtimeEnv);
    installProvisioningDbMock(mockDb, store);

    const response = await createSaas(buildCreateSaasRequest({ slug: "quota-allowed" }) as any);
    expect(response.status).toBe(202);

    const payload = await response.json() as QueuedPayload;
    expect(payload.ok).toBe(true);
    expect(payload.queued).toBe(true);
    expect(payload.jobId).toBeTruthy();
    expect(store.sentQueueMessages).toHaveLength(1);
    expect(store.provisioningJobs).toHaveLength(1);
  });
});
