import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBootstrapSocialflowRuntimeSeedSmokeLocal } from "../scripts/bootstrap-socialflow-runtime-seed-smoke-local";

type FixtureSchemaState = {
  draco: {
    hasSaasTable: boolean;
    saasColumns: string[];
  };
  social: {
    hasSeedTable: boolean;
  };
  auth: {
    hasUsersTable: boolean;
    hasCredentialsTable: boolean;
    hasSessionsTable: boolean;
  };
};

describe("socialflow runtime seed smoke bootstrap", () => {
  it("is idempotent and supports dry-run in fixtures mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-seed-smoke-bootstrap-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await fs.mkdir(fixturesDir, { recursive: true });

    const initialSchema: FixtureSchemaState = {
      draco: {
        hasSaasTable: false,
        saasColumns: ["id", "name", "slug", "domain", "status", "created_at"],
      },
      social: {
        hasSeedTable: false,
      },
      auth: {
        hasUsersTable: false,
        hasCredentialsTable: false,
        hasSessionsTable: false,
      },
    };

    await fs.writeFile(
      path.join(fixturesDir, "bootstrap-socialflow-runtime-seed-schema.json"),
      `${JSON.stringify(initialSchema, null, 2)}\n`,
      "utf8",
    );
    await fs.writeFile(path.join(fixturesDir, "core-saas.json"), "[]\n", "utf8");
    await fs.writeFile(path.join(fixturesDir, "socialflow-seed-metadata.json"), "[]\n", "utf8");

    const dryRun = await runBootstrapSocialflowRuntimeSeedSmokeLocal({
      dryRun: true,
      fixturesDir,
      log: () => {},
    });

    expect(dryRun.mode).toBe("fixtures");
    expect(dryRun.dryRun).toBe(true);
    expect(dryRun.createdTables).toEqual([
      "DRACO_DB.saas",
      "SOCIAL_DB.socialflow_seed_metadata",
    ]);
    expect(dryRun.addedColumns).toContain("DRACO_DB.saas.tenant_id");
    expect(dryRun.addedColumns).toContain("DRACO_DB.saas.blueprint_snapshot");
    expect(dryRun.ensuredAuthTables).toEqual([
      "SOCIALFLOW_AUTHS_DB.socialflow_users",
      "SOCIALFLOW_AUTHS_DB.socialflow_credentials",
      "SOCIALFLOW_AUTHS_DB.socialflow_sessions",
    ]);
    expect(dryRun.insertedCoreSeeds).toBe(1);
    expect(dryRun.insertedSocialSeeds).toBe(1);

    const dryRunCoreRaw = await fs.readFile(path.join(fixturesDir, "core-saas.json"), "utf8");
    const dryRunSocialRaw = await fs.readFile(path.join(fixturesDir, "socialflow-seed-metadata.json"), "utf8");
    const dryRunSchemaRaw = await fs.readFile(path.join(fixturesDir, "bootstrap-socialflow-runtime-seed-schema.json"), "utf8");
    expect(JSON.parse(dryRunCoreRaw)).toEqual([]);
    expect(JSON.parse(dryRunSocialRaw)).toEqual([]);
    expect(JSON.parse(dryRunSchemaRaw)).toEqual(initialSchema);

    const firstApply = await runBootstrapSocialflowRuntimeSeedSmokeLocal({
      dryRun: false,
      fixturesDir,
      log: () => {},
    });
    expect(firstApply.insertedCoreSeeds).toBe(1);
    expect(firstApply.insertedSocialSeeds).toBe(1);

    const secondApply = await runBootstrapSocialflowRuntimeSeedSmokeLocal({
      dryRun: false,
      fixturesDir,
      log: () => {},
    });
    expect(secondApply.insertedCoreSeeds).toBe(0);
    expect(secondApply.insertedSocialSeeds).toBe(0);
    expect(secondApply.coreSeed?.slug).toBe("socialflow");

    const appliedSchemaRaw = await fs.readFile(path.join(fixturesDir, "bootstrap-socialflow-runtime-seed-schema.json"), "utf8");
    const appliedCoreRaw = await fs.readFile(path.join(fixturesDir, "core-saas.json"), "utf8");
    const appliedSocialRaw = await fs.readFile(path.join(fixturesDir, "socialflow-seed-metadata.json"), "utf8");

    const appliedSchema = JSON.parse(appliedSchemaRaw) as FixtureSchemaState;
    const appliedCoreRows = JSON.parse(appliedCoreRaw) as Array<{ tenant_id: string; slug: string }>;
    const appliedSocialRows = JSON.parse(appliedSocialRaw) as Array<{ tenant_id: string; slug: string }>;

    expect(appliedSchema.draco.hasSaasTable).toBe(true);
    expect(appliedSchema.social.hasSeedTable).toBe(true);
    expect(appliedSchema.auth.hasUsersTable).toBe(true);
    expect(appliedSchema.auth.hasCredentialsTable).toBe(true);
    expect(appliedSchema.auth.hasSessionsTable).toBe(true);
    expect(appliedSchema.draco.saasColumns).toContain("tenant_id");
    expect(appliedSchema.draco.saasColumns).toContain("blueprint_snapshot");
    expect(appliedCoreRows.length).toBe(1);
    expect(appliedCoreRows[0]?.tenant_id).toBe("tenant_socialflow_runtime_seed_local");
    expect(appliedCoreRows[0]?.slug).toBe("socialflow");
    expect(appliedSocialRows.length).toBe(1);
    expect(appliedSocialRows[0]?.tenant_id).toBe("tenant_socialflow_runtime_seed_local");
    expect(appliedSocialRows[0]?.slug).toBe("socialflow");
  });
});
