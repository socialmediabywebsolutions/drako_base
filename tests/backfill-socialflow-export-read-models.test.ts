import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowExportReadModels } from "../scripts/backfill-socialflow-export-read-models";

type FixtureSchema = {
  bindings: {
    draco: boolean;
    social: boolean;
  };
  draco: {
    tables: string[];
    saasColumns: string[];
  };
  social: {
    tables: string[];
  };
};

type FixtureSource = {
  saas: Array<Record<string, unknown>>;
  tenant_strategic_dossiers: Array<Record<string, unknown>>;
  agent_work_logs: Array<Record<string, unknown>>;
  orchestrator_messages: Array<Record<string, unknown>>;
  economic_events: Array<Record<string, unknown>>;
  saas_domains: Array<Record<string, unknown>>;
};

type FixtureTarget = Array<Record<string, unknown>>;

const BASE_SCHEMA: FixtureSchema = {
  bindings: {
    draco: true,
    social: true,
  },
  draco: {
    tables: [
      "saas",
      "tenant_strategic_dossiers",
      "agent_work_logs",
      "orchestrator_messages",
      "economic_events",
      "saas_domains",
    ],
    saasColumns: [
      "id",
      "tenant_id",
      "slug",
      "name",
      "blueprint_snapshot",
      "plan_tier",
      "mrr_eur",
      "cost_eur",
      "risk_level",
      "created_at",
    ],
  },
  social: {
    tables: ["socialflow_export_read_models"],
  },
};

const BASE_SOURCE: FixtureSource = {
  saas: [
    {
      id: "saas_alpha",
      tenant_id: "tenant_alpha",
      slug: "socialflow",
      name: "SocialFlow Alpha",
      blueprint_snapshot: "{\"score\": 98}",
      plan_tier: "growth",
      mrr_eur: 124.5,
      cost_eur: 41.2,
      risk_level: "low",
      created_at: "2026-05-20T00:00:00.000Z",
    },
  ],
  tenant_strategic_dossiers: [
    {
      id: "dossier_alpha",
      tenant_id: "tenant_alpha",
      form_data: "{\"company\":\"Alpha\"}",
      analysis_data: "{\"ok\":true}",
      plan_data: "{\"plan\":\"scale\"}",
      status: "active",
      created_at: "2026-05-20T00:00:00.000Z",
    },
  ],
  agent_work_logs: [
    {
      id: "log_alpha",
      tenant_id: "tenant_alpha",
      saas_id: "saas_alpha",
      agent_name: "GrowthAgent",
      action_type: "publish",
      status: "ok",
      output_json: "{\"post\":\"done\"}",
      cost_eur: 1.25,
      created_at: "2026-05-21T00:00:00.000Z",
    },
  ],
  orchestrator_messages: [
    {
      tenant_id: "tenant_alpha",
      role: "assistant",
      content: "message",
      created_at: "2026-05-21T00:00:00.000Z",
    },
  ],
  economic_events: [
    {
      id: "evt_alpha",
      tenant_id: "tenant_alpha",
      saas_id: "saas_alpha",
      type: "EXPORT_GENERATED",
      severity: "info",
      payload_json: "{\"kind\":\"export\"}",
      created_at: "2026-05-21T00:00:00.000Z",
    },
  ],
  saas_domains: [
    {
      tenant_id: "tenant_alpha",
      saas_id: "saas_alpha",
      domain: "alpha.socialflow.local",
      is_primary: 1,
      status: "active",
    },
  ],
};

async function writeFixtures(
  fixturesDir: string,
  schema: FixtureSchema,
  source: FixtureSource,
  target: FixtureTarget,
) {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-export-backfill-schema.json"),
    `${JSON.stringify(schema, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-export-core-source.json"),
    `${JSON.stringify(source, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-export-read-models.json"),
    `${JSON.stringify(target, null, 2)}\n`,
    "utf8",
  );
}

describe("socialflow export read models backfill", () => {
  it("supports dry-run without mutating target fixtures", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-read-model-dry-run-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    const before = await fs.readFile(path.join(fixturesDir, "socialflow-export-read-models.json"), "utf8");

    const report = await runBackfillSocialflowExportReadModels({
      fixturesDir,
      dryRun: true,
      log: () => {},
    });

    const after = await fs.readFile(path.join(fixturesDir, "socialflow-export-read-models.json"), "utf8");

    expect(report.mode).toBe("fixtures");
    expect(report.dryRun).toBe(true);
    expect(report.scanned).toBe(1);
    expect(report.selected).toBe(1);
    expect(report.inserts).toBe(1);
    expect(report.updates).toBe(0);
    expect(report.unchanged).toBe(0);
    expect(after).toBe(before);
  });

  it("applies inserts and remains idempotent on second execution", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-read-model-apply-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    const firstApply = await runBackfillSocialflowExportReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(firstApply.inserts).toBe(1);
    expect(firstApply.updates).toBe(0);
    expect(firstApply.unchanged).toBe(0);

    const secondApply = await runBackfillSocialflowExportReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(secondApply.inserts).toBe(0);
    expect(secondApply.updates).toBe(0);
    expect(secondApply.unchanged).toBe(1);
  });

  it("fails closed when a required binding is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-read-model-binding-missing-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(
      fixturesDir,
      {
        ...BASE_SCHEMA,
        bindings: {
          ...BASE_SCHEMA.bindings,
          social: false,
        },
      },
      BASE_SOURCE,
      [],
    );

    await expect(
      runBackfillSocialflowExportReadModels({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_EXPORT_READ_MODELS_BACKFILL_BINDING_MISSING:SOCIAL_DB");
  });

  it("fails closed when a required table is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-read-model-table-missing-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(
      fixturesDir,
      {
        ...BASE_SCHEMA,
        social: {
          tables: [],
        },
      },
      BASE_SOURCE,
      [],
    );

    await expect(
      runBackfillSocialflowExportReadModels({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_EXPORT_READ_MODELS_BACKFILL_TABLE_MISSING:socialflow_export_read_models");
  });
});
