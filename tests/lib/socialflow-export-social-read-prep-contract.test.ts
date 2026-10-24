import { describe, expect, it, vi } from "vitest";
import { createSocialFlowExportSocialReadPrepContract } from "@/lib/socialflow/contracts/export-core-read";

describe("socialflow export social read prep contract", () => {
  it("reads prepared read model rows from SOCIAL_DB-owned table contract", async () => {
    const queryOne = vi.fn().mockResolvedValue({
      id: "model_1",
      tenant_id: "tenant_1",
      saas_id: "saas_1",
      slug: "socialflow",
      status: "ready",
      dossier_json: "{}",
      blueprint_json: "{}",
      work_logs_csv: "id\n",
      orchestrator_messages_csv: "role\n",
      financials_csv: "metric\n",
      economic_events_csv: "id\n",
      domains_json: "[]",
      meta_json: "{}",
      source_revision: "core:1",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
    const run = vi.fn();
    const contract = createSocialFlowExportSocialReadPrepContract({
      queryOne,
      run,
    });

    const row = await contract.getPreparedExportReadModel("tenant_1", "saas_1");

    expect(row?.tenant_id).toBe("tenant_1");
    expect(queryOne).toHaveBeenCalledOnce();
    expect(queryOne.mock.calls[0]?.[0]).toContain("FROM socialflow_export_read_models");
    expect(queryOne.mock.calls[0]?.[1]).toBe("tenant_1");
    expect(queryOne.mock.calls[0]?.[2]).toBe("saas_1");
  });

  it("fails closed when SOCIAL_DB prep upsert is not successful", async () => {
    const queryOne = vi.fn().mockResolvedValue(null);
    const run = vi.fn().mockResolvedValue(false);
    const contract = createSocialFlowExportSocialReadPrepContract({
      queryOne,
      run,
    });

    await expect(
      contract.upsertPreparedExportReadModel({
        id: "model_2",
        tenantId: "tenant_2",
        saasId: "saas_2",
        slug: "socialflow",
        status: "ready",
        sourceRevision: "core:2",
        payload: {
          dossierJson: "{}",
          blueprintJson: "{}",
          workLogsCsv: "id\n",
          orchestratorMessagesCsv: "role\n",
          financialsCsv: "metric\n",
          economicEventsCsv: "id\n",
          domainsJson: "[]",
          metaJson: "{}",
        },
      }),
    ).rejects.toThrow("SOCIALFLOW_EXPORT_PREPARED_READ_MODEL_UPSERT_FAILED");
  });
});
