import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  runCheckSocialflowRuntimeSeedParity,
  runCheckSocialflowRuntimeSeedParityCli,
} from "../scripts/check-socialflow-runtime-seed-parity";

type CoreFixtureRow = {
  id: string;
  tenant_id: string;
  slug: string;
  domain: string | null;
  status: string | null;
  created_at: string | null;
};

type SocialFixtureRow = {
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string;
  status: string;
};

async function writeFixtures(fixturesDir: string, coreRows: CoreFixtureRow[], socialRows: SocialFixtureRow[]) {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(path.join(fixturesDir, "core-saas.json"), `${JSON.stringify(coreRows, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(fixturesDir, "socialflow-seed-metadata.json"), `${JSON.stringify(socialRows, null, 2)}\n`, "utf8");
}

describe("socialflow runtime seed parity", () => {
  it("passes when parity is OK", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-seed-parity-ok-"));
    const fixturesDir = path.join(tmpDir, "fixtures");

    await writeFixtures(
      fixturesDir,
      [{
        id: "saas_alpha",
        tenant_id: "tenant_alpha",
        slug: "socialflow",
        domain: "alpha.socialflow.local",
        status: "active",
        created_at: "2026-05-01T00:00:00.000Z",
      }],
      [{
        tenant_id: "tenant_alpha",
        saas_id: "saas_alpha",
        slug: "socialflow",
        domain: "alpha.socialflow.local",
        status: "active",
      }],
    );

    const report = await runCheckSocialflowRuntimeSeedParity({ fixturesDir, log: () => {} });
    expect(report.matched).toBe(1);
    expect(report.missingInSocial).toHaveLength(0);
    expect(report.missingInCore).toHaveLength(0);
    expect(report.mismatched).toHaveLength(0);
  });

  it("detects missing target in socialflow_seed_metadata", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-seed-parity-missing-social-"));
    const fixturesDir = path.join(tmpDir, "fixtures");

    await writeFixtures(
      fixturesDir,
      [{
        id: "saas_alpha",
        tenant_id: "tenant_alpha",
        slug: "socialflow",
        domain: "alpha.socialflow.local",
        status: "active",
        created_at: "2026-05-01T00:00:00.000Z",
      }],
      [],
    );

    const report = await runCheckSocialflowRuntimeSeedParity({ fixturesDir, log: () => {} });
    expect(report.missingInSocial).toHaveLength(1);
    expect(report.matched).toBe(0);
  });

  it("detects mismatched fields", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-seed-parity-mismatch-"));
    const fixturesDir = path.join(tmpDir, "fixtures");

    await writeFixtures(
      fixturesDir,
      [{
        id: "saas_alpha",
        tenant_id: "tenant_alpha",
        slug: "socialflow",
        domain: "alpha.socialflow.local",
        status: "active",
        created_at: "2026-05-01T00:00:00.000Z",
      }],
      [{
        tenant_id: "tenant_alpha",
        saas_id: "saas_alpha",
        slug: "socialflow",
        domain: "wrong.socialflow.local",
        status: "inactive",
      }],
    );

    const report = await runCheckSocialflowRuntimeSeedParity({ fixturesDir, log: () => {} });
    expect(report.mismatched).toHaveLength(1);
    expect(report.mismatched[0]?.fields).toEqual(["domain", "status"]);
  });

  it("returns non-zero on drift unless --allow-drift is used", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-seed-parity-cli-"));
    const fixturesDir = path.join(tmpDir, "fixtures");

    await writeFixtures(
      fixturesDir,
      [{
        id: "saas_alpha",
        tenant_id: "tenant_alpha",
        slug: "socialflow",
        domain: "alpha.socialflow.local",
        status: "active",
        created_at: "2026-05-01T00:00:00.000Z",
      }],
      [],
    );

    const strictCode = await runCheckSocialflowRuntimeSeedParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    const allowCode = await runCheckSocialflowRuntimeSeedParityCli(
      [`--fixtures-dir=${fixturesDir}`, "--allow-drift"],
      { log: () => {}, error: () => {} },
    );

    expect(strictCode).toBe(2);
    expect(allowCode).toBe(0);
  });
});
