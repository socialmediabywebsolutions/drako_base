import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillProvisioningSuccess } from "../scripts/backfill-provisioning-success";

async function copyDir(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else {
      await fs.copyFile(from, to);
    }
  }
}

describe("provisioning ACTIVE -> SUCCESS backfill", () => {
  it("is idempotent in fixtures mode", async () => {
    const fixtureSource = path.resolve(process.cwd(), "tests/fixtures/production-audits/pass");
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-backfill-"));
    const fixtureCopy = path.join(tmpDir, "pass");

    await copyDir(fixtureSource, fixtureCopy);

    const first = await runBackfillProvisioningSuccess({ fixturesDir: fixtureCopy, log: () => {} });

    expect(first.mode).toBe("fixtures");
    expect(first.scanned).toBeGreaterThan(0);
    expect(first.updated).toBe(2);

    const firstRaw = await fs.readFile(path.join(fixtureCopy, "provisioning-jobs.json"), "utf8");
    const firstRows = JSON.parse(firstRaw) as Array<{ current_state: string }>;
    expect(firstRows.some((row) => row.current_state === "ACTIVE")).toBe(false);

    const second = await runBackfillProvisioningSuccess({ fixturesDir: fixtureCopy, log: () => {} });

    expect(second.scanned).toBe(first.scanned);
    expect(second.updated).toBe(0);
    expect(second.skipped).toBe(second.scanned);
  });
});
