import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBootstrapSocialflowLegacyReadModelsSmokeLocal } from "../scripts/bootstrap-socialflow-legacy-read-models-smoke-local";

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

async function writeSchema(fixturesDir: string, schema: FixtureSchema): Promise<void> {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-legacy-backfill-schema.json"),
    `${JSON.stringify(schema, null, 2)}\n`,
    "utf8",
  );
}

describe("socialflow legacy read models smoke bootstrap", () => {
  it("supports dry-run, apply, and idempotent second execution in fixtures mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-smoke-bootstrap-"));
    const fixturesDir = path.join(tmpDir, "fixtures");

    await writeSchema(fixturesDir, {
      bindings: {
        draco: true,
        social: true,
      },
      draco: {
        tables: [],
      },
      social: {
        tables: [],
      },
    });

    const initialSchemaRaw = await fs.readFile(path.join(fixturesDir, "socialflow-legacy-backfill-schema.json"), "utf8");

    const dryRun = await runBootstrapSocialflowLegacyReadModelsSmokeLocal({
      fixturesDir,
      dryRun: true,
      log: () => {},
    });
    expect(dryRun.mode).toBe("fixtures");
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.createdTables).toContain("SOCIAL_DB.socialflow_legacy_strategic_dossiers");
    expect(dryRun.createdTables).toContain("SOCIAL_DB.socialflow_legacy_tenant_progress");
    expect(dryRun.createdTables).toContain("SOCIAL_DB.socialflow_legacy_agent_work_logs");
    expect(dryRun.createdTables).toContain("SOCIAL_DB.socialflow_legacy_repository_context");

    const afterDryRunSchemaRaw = await fs.readFile(path.join(fixturesDir, "socialflow-legacy-backfill-schema.json"), "utf8");
    expect(afterDryRunSchemaRaw).toBe(initialSchemaRaw);

    const firstApply = await runBootstrapSocialflowLegacyReadModelsSmokeLocal({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(firstApply.createdTables.length).toBe(4);
    expect(firstApply.ensuredTables.length).toBe(4);

    const secondApply = await runBootstrapSocialflowLegacyReadModelsSmokeLocal({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(secondApply.createdTables).toHaveLength(0);
    expect(secondApply.ensuredTables.length).toBe(4);
  });

  it("fails closed when SOCIAL_DB binding is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-legacy-smoke-bootstrap-binding-"));
    const fixturesDir = path.join(tmpDir, "fixtures");

    await writeSchema(fixturesDir, {
      bindings: {
        draco: true,
        social: false,
      },
      draco: {
        tables: [],
      },
      social: {
        tables: [],
      },
    });

    await expect(
      runBootstrapSocialflowLegacyReadModelsSmokeLocal({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:SOCIAL_DB");
  });
});
