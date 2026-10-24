import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowExportReadModels } from "../scripts/backfill-socialflow-export-read-models";
import { runCheckSocialflowExportReadModelsParity } from "../scripts/check-socialflow-export-read-models-parity";
import { runBootstrapSocialflowExportReadModelsSmokeLocal } from "../scripts/bootstrap-socialflow-export-read-models-smoke-local";

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
  saas_instances: Array<Record<string, unknown>>;
};

const BASE_SCHEMA: FixtureSchema = {
  bindings: {
    draco: true,
    social: true,
  },
  draco: {
    tables: [],
    saasColumns: ["id", "slug"],
  },
  social: {
    tables: [],
  },
};

const BASE_SOURCE: FixtureSource = {
  saas: [],
  tenant_strategic_dossiers: [],
  agent_work_logs: [],
  orchestrator_messages: [],
  economic_events: [],
  saas_domains: [],
  saas_instances: [],
};

async function writeFixtures(fixturesDir: string, schema: FixtureSchema, source: FixtureSource) {
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
    "[]\n",
    "utf8",
  );
}

describe("socialflow export read models smoke bootstrap", () => {
  it("supports dry-run, apply, and idempotent second execution in fixtures mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-smoke-bootstrap-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE);

    const initialSchemaRaw = await fs.readFile(path.join(fixturesDir, "socialflow-export-backfill-schema.json"), "utf8");
    const initialSourceRaw = await fs.readFile(path.join(fixturesDir, "socialflow-export-core-source.json"), "utf8");

    const dryRun = await runBootstrapSocialflowExportReadModelsSmokeLocal({
      fixturesDir,
      dryRun: true,
      log: () => {},
    });

    expect(dryRun.mode).toBe("fixtures");
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.createdTables).toContain("DRACO_DB.tenants");
    expect(dryRun.createdTables).toContain("DRACO_DB.agent_work_logs");
    expect(dryRun.createdTables).toContain("SOCIAL_DB.socialflow_export_read_models");
    expect(dryRun.addedColumns).toContain("DRACO_DB.saas.tenant_id");
    expect(dryRun.insertedSeeds).toBe(7);
    expect(dryRun.unchangedSeeds).toBe(0);

    const afterDrySchemaRaw = await fs.readFile(path.join(fixturesDir, "socialflow-export-backfill-schema.json"), "utf8");
    const afterDrySourceRaw = await fs.readFile(path.join(fixturesDir, "socialflow-export-core-source.json"), "utf8");
    expect(afterDrySchemaRaw).toBe(initialSchemaRaw);
    expect(afterDrySourceRaw).toBe(initialSourceRaw);

    const firstApply = await runBootstrapSocialflowExportReadModelsSmokeLocal({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(firstApply.insertedSeeds).toBe(7);
    expect(firstApply.unchangedSeeds).toBe(0);

    const secondApply = await runBootstrapSocialflowExportReadModelsSmokeLocal({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(secondApply.insertedSeeds).toBe(0);
    expect(secondApply.unchangedSeeds).toBe(7);

    const backfillReport = await runBackfillSocialflowExportReadModels({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(backfillReport.inserts).toBe(1);

    const parityReport = await runCheckSocialflowExportReadModelsParity({
      fixturesDir,
      log: () => {},
    });
    expect(parityReport.matched).toBe(1);
    expect(parityReport.missingInSocial).toHaveLength(0);
    expect(parityReport.missingInCore).toHaveLength(0);
    expect(parityReport.mismatched).toHaveLength(0);
  });

  it("fails closed when required binding is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-export-smoke-bootstrap-binding-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(
      fixturesDir,
      {
        ...BASE_SCHEMA,
        bindings: {
          draco: true,
          social: false,
        },
      },
      BASE_SOURCE,
    );

    await expect(
      runBootstrapSocialflowExportReadModelsSmokeLocal({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:SOCIAL_DB");
  });
});
