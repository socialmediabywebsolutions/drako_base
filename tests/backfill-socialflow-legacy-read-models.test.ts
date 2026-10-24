import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowLegacyReadModels } from "../scripts/backfill-socialflow-legacy-read-models";

type FixtureSchema = {
  bindings: {
    draco: boolean;
    social: boolean;
  };
  draco: {
    tables: string[];
  };
  social: {
    tables: string[];
  };
};

type FixtureCoreSource = {
  tenant_strategic_dossiers: Array<Record<string, unknown>>;
  agent_work_logs: Array<Record<string, unknown>>;
  tenants: Array<Record<string, unknown>>;
  saas: Array<Record<string, unknown>>;
  saas_domains: Array<Record<string, unknown>>;
};

type FixtureSocialTarget = {
  socialflow_legacy_strategic_dossiers: Array<Record<string, unknown>>;
  socialflow_legacy_tenant_progress: Array<Record<string, unknown>>;
  socialflow_legacy_agent_work_logs: Array<Record<string, unknown>>;
  socialflow_legacy_repository_context: Array<Record<string, unknown>>;
};

const BASE_SCHEMA: FixtureSchema = {
  bindings: {
    draco: true,
    social: true,
  },
  draco: {
    tables: [
      "tenant_strategic_dossiers",
      "agent_work_logs",
      "tenants",
      "saas",
      "saas_domains",
    ],
  },
  social: {
    tables: [
      "socialflow_legacy_strategic_dossiers",
      "socialflow_legacy_tenant_progress",
      "socialflow_legacy_agent_work_logs",
      "socialflow_legacy_repository_context",
    ],
  },
};

const BASE_SOURCE: FixtureCoreSource = {
  tenant_strategic_dossiers: [
    {
      id: "dossier_alpha",
      tenant_id: "tenant_alpha",
      status: "active",
      version: 2,
      form_data: "{\"company\":\"alpha\"}",
      analysis_data: "{\"ok\":true}",
      plan_data: "{\"plan\":\"scale\"}",
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T01:00:00.000Z",
    },
  ],
  agent_work_logs: [
    {
      id: "worklog_alpha",
      tenant_id: "tenant_alpha",
      saas_id: "saas_social_alpha",
      agent_name: "planner",
      action_type: "build",
      status: "ok",
      output_json: "{\"result\":\"done\"}",
      cost_eur: 1.5,
      created_at: "2026-05-24T02:00:00.000Z",
      updated_at: "2026-05-24T02:10:00.000Z",
    },
  ],
  tenants: [
    {
      tenant_id: "tenant_alpha",
      materialization_step: 3,
      updated_at: "2026-05-24T03:00:00.000Z",
    },
  ],
  saas: [
    {
      id: "saas_social_alpha",
      tenant_id: "tenant_alpha",
      slug: "socialflow",
      status: "active",
      created_at: "2026-05-24T04:00:00.000Z",
      updated_at: "2026-05-24T04:00:00.000Z",
    },
    {
      id: "saas_ignored",
      tenant_id: "tenant_alpha",
      slug: "mentoria",
      status: "active",
      created_at: "2026-05-24T04:30:00.000Z",
      updated_at: "2026-05-24T04:30:00.000Z",
    },
  ],
  saas_domains: [
    {
      tenant_id: "tenant_alpha",
      saas_id: "saas_social_alpha",
      domain: "alpha.socialflow.local",
      is_primary: 1,
      status: "active",
    },
  ],
};

const EMPTY_TARGET: FixtureSocialTarget = {
  socialflow_legacy_strategic_dossiers: [],
  socialflow_legacy_tenant_progress: [],
  socialflow_legacy_agent_work_logs: [],
  socialflow_legacy_repository_context: [],
};

async function writeFixtures(
  fixturesDir: string,
  schema: FixtureSchema,
  source: FixtureCoreSource,
  target: FixtureSocialTarget,
) {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-legacy-backfill-schema.json"),
    `${JSON.stringify(schema, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-legacy-core-source.json"),
    `${JSON.stringify(source, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-legacy-read-models.json"),
    `${JSON.stringify(target, null, 2)}\n`,
    "utf8",
  );
}

describe("socialflow legacy read models backfill", () => {
  it("supports dry-run without mutating target fixtures", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-backfill-dry-run-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, EMPTY_TARGET);

    const before = await fs.readFile(path.join(fixturesDir, "socialflow-legacy-read-models.json"), "utf8");

    const report = await runBackfillSocialflowLegacyReadModels({
      fixturesDir,
      dryRun: true,
      log: () => {},
    });

    const after = await fs.readFile(path.join(fixturesDir, "socialflow-legacy-read-models.json"), "utf8");

    expect(report.mode).toBe("fixtures");
    expect(report.dryRun).toBe(true);
    expect(report.inserts).toBe(4);
    expect(report.updates).toBe(0);
    expect(report.unchanged).toBe(0);
    expect(report.tables.socialflow_legacy_strategic_dossiers.selected).toBe(1);
    expect(report.tables.socialflow_legacy_tenant_progress.selected).toBe(1);
    expect(report.tables.socialflow_legacy_agent_work_logs.selected).toBe(1);
    expect(report.tables.socialflow_legacy_repository_context.selected).toBe(1);
    expect(after).toBe(before);
  });

  it("applies inserts and remains idempotent on second execution", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-backfill-apply-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, EMPTY_TARGET);

    const firstApply = await runBackfillSocialflowLegacyReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    expect(firstApply.inserts).toBe(4);
    expect(firstApply.updates).toBe(0);
    expect(firstApply.unchanged).toBe(0);

    const secondApply = await runBackfillSocialflowLegacyReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    expect(secondApply.inserts).toBe(0);
    expect(secondApply.updates).toBe(0);
    expect(secondApply.unchanged).toBe(4);
  });

  it("fails closed when a required binding is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-backfill-binding-missing-"));
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
      EMPTY_TARGET,
    );

    await expect(
      runBackfillSocialflowLegacyReadModels({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_BINDING_MISSING:SOCIAL_DB");
  });

  it("fails closed when a required table is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-backfill-table-missing-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(
      fixturesDir,
      {
        ...BASE_SCHEMA,
        draco: {
          tables: [
            "tenant_strategic_dossiers",
            "tenants",
            "saas",
            "saas_domains",
          ],
        },
      },
      BASE_SOURCE,
      EMPTY_TARGET,
    );

    await expect(
      runBackfillSocialflowLegacyReadModels({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_READ_MODELS_BACKFILL_TABLE_MISSING:agent_work_logs");
  });
});
