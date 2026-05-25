import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowExportReadModels } from "../scripts/backfill-socialflow-export-read-models";
import {
  runCheckSocialflowExportReadModelsParity,
  runCheckSocialflowExportReadModelsParityCli,
} from "../scripts/check-socialflow-export-read-models-parity";

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
  target: Array<Record<string, unknown>> = [],
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

describe("socialflow export read models parity", () => {
  it("returns exit 0 when there is no drift in fixtures mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-parity-ok-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    await runBackfillSocialflowExportReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const report = await runCheckSocialflowExportReadModelsParity({
      fixturesDir,
      log: () => {},
    });
    const code = await runCheckSocialflowExportReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );

    expect(report.mode).toBe("fixtures");
    expect(report.matched).toBe(1);
    expect(report.missingInSocial).toHaveLength(0);
    expect(report.missingInCore).toHaveLength(0);
    expect(report.mismatched).toHaveLength(0);
    expect(code).toBe(0);
  });

  it("returns exit 2 with drift and no allow-drift", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-parity-drift-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    await runBackfillSocialflowExportReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const targetPath = path.join(fixturesDir, "socialflow-export-read-models.json");
    const targetRaw = await fs.readFile(targetPath, "utf8");
    const targetRows = JSON.parse(targetRaw) as Array<Record<string, unknown>>;
    targetRows[0] = {
      ...targetRows[0],
      status: "stale",
    };
    await fs.writeFile(targetPath, `${JSON.stringify(targetRows, null, 2)}\n`, "utf8");

    const code = await runCheckSocialflowExportReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(code).toBe(2);
  });

  it("returns exit 0 with drift when allow-drift is enabled", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-parity-allow-drift-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    await runBackfillSocialflowExportReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const targetPath = path.join(fixturesDir, "socialflow-export-read-models.json");
    const targetRaw = await fs.readFile(targetPath, "utf8");
    const targetRows = JSON.parse(targetRaw) as Array<Record<string, unknown>>;
    targetRows[0] = {
      ...targetRows[0],
      source_revision: "drifted-revision",
    };
    await fs.writeFile(targetPath, `${JSON.stringify(targetRows, null, 2)}\n`, "utf8");

    const code = await runCheckSocialflowExportReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`, "--allow-drift"],
      { log: () => {}, error: () => {} },
    );
    expect(code).toBe(0);
  });

  it("fails closed when required binding or table is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-parity-fail-closed-"));
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

    const codeMissingBinding = await runCheckSocialflowExportReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(codeMissingBinding).toBe(1);

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
    const codeMissingTable = await runCheckSocialflowExportReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(codeMissingTable).toBe(1);
  });
});
