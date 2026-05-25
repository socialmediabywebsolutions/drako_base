import { describe, expect, it, vi } from "vitest";
import { createSocialFlowLegacyActionsSocialOwnershipPrepContract } from "@/lib/socialflow/contracts/legacy-actions-core";
import { createSocialFlowLegacyRepositorySocialOwnershipPrepContract } from "@/lib/socialflow/contracts/repository-core-context";

describe("socialflow legacy social ownership prep contract", () => {
  it("reads prepared strategic dossier rows from SOCIAL_DB-owned legacy table", async () => {
    const queryOne = vi.fn().mockResolvedValue({
      id: "legacy_dossier_1",
      tenant_id: "tenant_1",
      dossier_id: "dossier_1",
      status: "active",
      version: 2,
      form_data_json: "{}",
      analysis_data_json: "{}",
      plan_data_json: "{}",
      source_updated_at: "2026-01-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const queryAll = vi.fn().mockResolvedValue([]);
    const run = vi.fn().mockResolvedValue(true);
    const contract = createSocialFlowLegacyActionsSocialOwnershipPrepContract({
      queryOne,
      queryAll,
      run,
    });

    const row = await contract.getPreparedLatestStrategicDossier("tenant_1");

    expect(row?.tenant_id).toBe("tenant_1");
    expect(queryOne).toHaveBeenCalledOnce();
    expect(queryOne.mock.calls[0]?.[0]).toContain("FROM socialflow_legacy_strategic_dossiers");
    expect(queryOne.mock.calls[0]?.[1]).toBe("tenant_1");
  });

  it("fails closed when legacy strategic dossier prep upsert is not successful", async () => {
    const queryOne = vi.fn().mockResolvedValue(null);
    const queryAll = vi.fn().mockResolvedValue([]);
    const run = vi.fn().mockResolvedValue(false);
    const contract = createSocialFlowLegacyActionsSocialOwnershipPrepContract({
      queryOne,
      queryAll,
      run,
    });

    await expect(
      contract.upsertPreparedStrategicDossier({
        id: "legacy_dossier_2",
        tenantId: "tenant_2",
        dossierId: "dossier_2",
        status: "draft",
        version: 1,
        formDataJson: "{}",
        analysisDataJson: null,
        planDataJson: null,
        sourceUpdatedAt: null,
      }),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_STRATEGIC_DOSSIER_PREP_UPSERT_FAILED");
  });

  it("lists prepared agent work logs from SOCIAL_DB-owned legacy table", async () => {
    const queryOne = vi.fn().mockResolvedValue(null);
    const queryAll = vi.fn().mockResolvedValue([
      {
        id: "legacy_log_1",
        tenant_id: "tenant_3",
        log_id: "work_log_1",
        saas_id: "socialflow",
        agent_name: "planner",
        action_type: "build",
        status: "ok",
        output_json: "{}",
        cost_eur: 0,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const run = vi.fn().mockResolvedValue(true);
    const contract = createSocialFlowLegacyActionsSocialOwnershipPrepContract({
      queryOne,
      queryAll,
      run,
    });

    const rows = await contract.listPreparedAgentWorkLogs("tenant_3");

    expect(rows).toHaveLength(1);
    expect(queryAll).toHaveBeenCalledOnce();
    expect(queryAll.mock.calls[0]?.[0]).toContain("FROM socialflow_legacy_agent_work_logs");
    expect(queryAll.mock.calls[0]?.[1]).toBe("tenant_3");
    expect(queryAll.mock.calls[0]?.[2]).toBe(10);
  });
});

describe("socialflow legacy repository social ownership prep contract", () => {
  it("reads prepared repository context from SOCIAL_DB-owned legacy table", async () => {
    const queryOne = vi.fn().mockResolvedValue({
      id: "legacy_repo_context_1",
      tenant_id: "tenant_1",
      saas_id: "socialflow",
      slug: "socialflow",
      domain: "socialflow.drako.systems",
      status: "active",
      metadata_json: "{}",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const run = vi.fn().mockResolvedValue(true);
    const contract = createSocialFlowLegacyRepositorySocialOwnershipPrepContract({
      queryOne,
      run,
    });

    const row = await contract.getPreparedRepositoryContext("tenant_1", "socialflow");

    expect(row?.saas_id).toBe("socialflow");
    expect(queryOne).toHaveBeenCalledOnce();
    expect(queryOne.mock.calls[0]?.[0]).toContain("FROM socialflow_legacy_repository_context");
    expect(queryOne.mock.calls[0]?.[1]).toBe("tenant_1");
    expect(queryOne.mock.calls[0]?.[2]).toBe("socialflow");
  });

  it("fails closed when repository context prep upsert is not successful", async () => {
    const queryOne = vi.fn().mockResolvedValue(null);
    const run = vi.fn().mockResolvedValue(false);
    const contract = createSocialFlowLegacyRepositorySocialOwnershipPrepContract({
      queryOne,
      run,
    });

    await expect(
      contract.upsertPreparedRepositoryContext({
        id: "legacy_repo_context_2",
        tenantId: "tenant_2",
        saasId: "socialflow",
        slug: "socialflow",
        domain: "socialflow.drako.systems",
        status: "active",
        metadataJson: "{}",
      }),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_REPOSITORY_CONTEXT_PREP_UPSERT_FAILED");
  });
});
