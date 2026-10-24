import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowRuntimeSeed } from "../scripts/backfill-socialflow-runtime-seed";

type SeedFixtureRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string;
  status: string;
  metadata_json: string;
  created_at: string;
  updated_at: string;
};

describe("socialflow runtime seed backfill", () => {
  it("supports dry-run and remains idempotent in fixtures mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-seed-backfill-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await fs.mkdir(fixturesDir, { recursive: true });

    const now = "2026-05-24T00:00:00.000Z";
    const sourceRows = [
      {
        id: "saas_alpha_new",
        tenant_id: "tenant_alpha",
        slug: "socialflow",
        name: "SocialFlow Alpha",
        domain: "alpha.socialflow.local",
        status: "active",
        created_at: "2026-05-02T00:00:00.000Z",
      },
      {
        id: "saas_alpha_old",
        tenant_id: "tenant_alpha",
        slug: "socialflows",
        name: "SocialFlow Alpha Legacy",
        domain: "old-alpha.socialflow.local",
        status: "inactive",
        created_at: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "saas_beta",
        tenant_id: "tenant_beta",
        slug: "socialflows",
        name: "SocialFlow Beta",
        domain: "beta.socialflow.local",
        status: "active",
        created_at: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "saas_gamma",
        tenant_id: "tenant_gamma",
        slug: "mentoria",
        name: "Mentoria",
        domain: "mentoria.local",
        status: "active",
        created_at: "2026-05-01T00:00:00.000Z",
      },
    ];

    const seedRows: SeedFixtureRow[] = [
      {
        id: "sf_seed_tenant_alpha_saas_alpha_new_socialflow",
        tenant_id: "tenant_alpha",
        saas_id: "saas_alpha_new",
        slug: "socialflow",
        domain: "old-alpha.socialflow.local",
        status: "inactive",
        metadata_json: JSON.stringify({ source: "core_saas_backfill", name: "SocialFlow Alpha Legacy", createdAt: "2026-05-01T00:00:00.000Z" }),
        created_at: now,
        updated_at: now,
      },
    ];

    await fs.writeFile(path.join(fixturesDir, "core-saas.json"), `${JSON.stringify(sourceRows, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(fixturesDir, "socialflow-seed-metadata.json"), `${JSON.stringify(seedRows, null, 2)}\n`, "utf8");

    const dryRunReport = await runBackfillSocialflowRuntimeSeed({
      fixturesDir,
      dryRun: true,
      log: () => {},
    });

    expect(dryRunReport.mode).toBe("fixtures");
    expect(dryRunReport.dryRun).toBe(true);
    expect(dryRunReport.scanned).toBe(4);
    expect(dryRunReport.selected).toBe(2);
    expect(dryRunReport.inserts).toBe(1);
    expect(dryRunReport.updates).toBe(1);
    expect(dryRunReport.unchanged).toBe(0);

    const beforeApplyRaw = await fs.readFile(path.join(fixturesDir, "socialflow-seed-metadata.json"), "utf8");
    const beforeApplyRows = JSON.parse(beforeApplyRaw) as SeedFixtureRow[];
    expect(beforeApplyRows).toHaveLength(1);

    const firstApply = await runBackfillSocialflowRuntimeSeed({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(firstApply.inserts).toBe(1);
    expect(firstApply.updates).toBe(1);

    const secondApply = await runBackfillSocialflowRuntimeSeed({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });
    expect(secondApply.inserts).toBe(0);
    expect(secondApply.updates).toBe(0);
    expect(secondApply.unchanged).toBe(2);
  });
});
