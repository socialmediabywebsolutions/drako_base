import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowLegacyReadModels } from "../scripts/backfill-socialflow-legacy-read-models";
import {
  runCheckSocialflowLegacyReadModelsParity,
  runCheckSocialflowLegacyReadModelsParityCli,
} from "../scripts/check-socialflow-legacy-read-models-parity";

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
      saas_id: "socialflow",
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
      id: "socialflow",
      tenant_id: "tenant_alpha",
      slug: "socialflow",
      status: "active",
      created_at: "2026-05-24T04:00:00.000Z",
      updated_at: "2026-05-24T04:00:00.000Z",
    },
  ],
  saas_domains: [
    {
      tenant_id: "tenant_alpha",
      saas_id: "socialflow",
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

describe("socialflow legacy read models parity", () => {
  it("returns exit 0 when there is no drift in fixtures mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-parity-ok-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, EMPTY_TARGET);

    await runBackfillSocialflowLegacyReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const report = await runCheckSocialflowLegacyReadModelsParity({
      fixturesDir,
      log: () => {},
    });
    const code = await runCheckSocialflowLegacyReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );

    expect(report.mode).toBe("fixtures");
    expect(report.matched).toBe(4);
    expect(report.missingInSocial).toHaveLength(0);
    expect(report.missingInCore).toHaveLength(0);
    expect(report.mismatched).toHaveLength(0);
    expect(code).toBe(0);
  });

  it("returns exit 2 with drift and no allow-drift", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-parity-drift-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, EMPTY_TARGET);

    await runBackfillSocialflowLegacyReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const targetPath = path.join(fixturesDir, "socialflow-legacy-read-models.json");
    const targetRaw = await fs.readFile(targetPath, "utf8");
    const targetRows = JSON.parse(targetRaw) as FixtureSocialTarget;
    targetRows.socialflow_legacy_tenant_progress[0] = {
      ...targetRows.socialflow_legacy_tenant_progress[0],
      materialization_step: 999,
    };
    await fs.writeFile(targetPath, `${JSON.stringify(targetRows, null, 2)}\n`, "utf8");

    const code = await runCheckSocialflowLegacyReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(code).toBe(2);
  });

  it("returns exit 0 with drift when allow-drift is enabled", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-parity-allow-drift-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, EMPTY_TARGET);

    await runBackfillSocialflowLegacyReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const targetPath = path.join(fixturesDir, "socialflow-legacy-read-models.json");
    const targetRaw = await fs.readFile(targetPath, "utf8");
    const targetRows = JSON.parse(targetRaw) as FixtureSocialTarget;
    targetRows.socialflow_legacy_repository_context[0] = {
      ...targetRows.socialflow_legacy_repository_context[0],
      metadata_json: "{\"source\":\"drifted\"}",
    };
    await fs.writeFile(targetPath, `${JSON.stringify(targetRows, null, 2)}\n`, "utf8");

    const code = await runCheckSocialflowLegacyReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`, "--allow-drift"],
      { log: () => {}, error: () => {} },
    );
    expect(code).toBe(0);
  });

  it("fails closed when required binding or table is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-parity-fail-closed-"));
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

    const codeMissingBinding = await runCheckSocialflowLegacyReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(codeMissingBinding).toBe(1);

    await writeFixtures(
      fixturesDir,
      {
        ...BASE_SCHEMA,
        draco: {
          tables: [
            "tenant_strategic_dossiers",
            "agent_work_logs",
            "tenants",
            "saas",
          ],
        },
      },
      BASE_SOURCE,
      EMPTY_TARGET,
    );
    const codeMissingTable = await runCheckSocialflowLegacyReadModelsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(codeMissingTable).toBe(1);
  });
});
