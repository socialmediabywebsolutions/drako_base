import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { queryAll, run } from "@/lib/db";

type BackfillMode = "fixtures" | "db";

type ProvisioningJobRow = {
  job_id: string;
  tenant_id: string | null;
  current_state: string;
};

type BackfillSample = {
  jobId: string;
  tenantId: string | null;
  from: string;
  to: string;
};

export type ProvisioningBackfillReport = {
  mode: BackfillMode;
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  sample: BackfillSample[];
};

type RunBackfillOptions = {
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

const FIXTURE_FILENAME = "provisioning-jobs.json";
const SAMPLE_LIMIT = 10;

function toSample(rows: ProvisioningJobRow[]): BackfillSample[] {
  return rows.slice(0, SAMPLE_LIMIT).map((row) => ({
    jobId: row.job_id,
    tenantId: row.tenant_id,
    from: row.current_state,
    to: "SUCCESS",
  }));
}

function isMissingTableOrColumnError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("no such table") || message.includes("no such column") || message.includes("table-missing") || message.includes("migrations-missing");
}

async function runFixtureBackfill(fixturesDir: string): Promise<ProvisioningBackfillReport> {
  const fixturePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_FILENAME);
  let raw: string;
  try {
    raw = await fs.readFile(fixturePath, "utf8");
  } catch (error) {
    throw new Error(`BACKFILL_FIXTURE_NOT_FOUND: expected ${FIXTURE_FILENAME} in ${fixturesDir}.`);
  }

  let rows: ProvisioningJobRow[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Fixture payload must be an array.");
    }
    rows = parsed.map((item, index) => {
      const row = item as Partial<ProvisioningJobRow>;
      if (typeof row.job_id !== "string" || typeof row.current_state !== "string") {
        throw new Error(`Invalid fixture row at index ${index}.`);
      }
      return {
        job_id: row.job_id,
        tenant_id: typeof row.tenant_id === "string" ? row.tenant_id : null,
        current_state: row.current_state,
      };
    });
  } catch (error) {
    throw new Error(`BACKFILL_FIXTURE_INVALID: ${(error as Error).message}`);
  }

  const activeRows = rows.filter((row) => row.current_state === "ACTIVE");
  const updatedRows = rows.map((row) =>
    row.current_state === "ACTIVE"
      ? {
          ...row,
          current_state: "SUCCESS",
        }
      : row,
  );

  await fs.writeFile(`${fixturePath}`, `${JSON.stringify(updatedRows, null, 2)}\n`, "utf8");

  return {
    mode: "fixtures",
    scanned: rows.length,
    updated: activeRows.length,
    skipped: rows.length - activeRows.length,
    errors: 0,
    sample: toSample(activeRows),
  };
}

async function assertProvisioningJobsShape(): Promise<void> {
  const tableRows = await queryAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'provisioning_jobs'",
  );
  if (!tableRows.length) {
    throw new Error("BACKFILL_TABLE_MISSING: provisioning_jobs table not found.");
  }

  const columns = await queryAll<{ name: string }>("PRAGMA table_info(provisioning_jobs)");
  if (!columns.length) {
    throw new Error("BACKFILL_SCHEMA_MISSING: provisioning_jobs schema unavailable.");
  }

  const required = new Set(["job_id", "tenant_id", "current_state"]);
  for (const column of required) {
    if (!columns.some((item) => item.name === column)) {
      throw new Error(`BACKFILL_COLUMN_MISSING: provisioning_jobs.${column} not found.`);
    }
  }
}

async function runDatabaseBackfill(): Promise<ProvisioningBackfillReport> {
  try {
    await assertProvisioningJobsShape();
  } catch (error) {
    if (isMissingTableOrColumnError(error)) {
      throw new Error(`BACKFILL_SCHEMA_ERROR: ${(error as Error).message}`);
    }
    throw error;
  }

  const rows = await queryAll<ProvisioningJobRow>(
    "SELECT job_id, tenant_id, current_state FROM provisioning_jobs ORDER BY created_at ASC",
  );

  const activeRows = rows.filter((row) => row.current_state === "ACTIVE");
  if (activeRows.length > 0) {
    const ok = await run(
      "UPDATE provisioning_jobs SET current_state = 'SUCCESS', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE current_state = 'ACTIVE'",
    );
    if (!ok) {
      throw new Error("BACKFILL_UPDATE_FAILED: unable to update provisioning_jobs ACTIVE rows.");
    }
  }

  return {
    mode: "db",
    scanned: rows.length,
    updated: activeRows.length,
    skipped: rows.length - activeRows.length,
    errors: 0,
    sample: toSample(activeRows),
  };
}

export async function runBackfillProvisioningSuccess(options: RunBackfillOptions = {}): Promise<ProvisioningBackfillReport> {
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const logger = options.log ?? console.log;

  const report = fixturesDir
    ? await runFixtureBackfill(fixturesDir)
    : await runDatabaseBackfill();

  logger(`BACKFILL_PROVISIONING_SUCCESS mode=${report.mode}`);
  logger(`scanned=${report.scanned} updated=${report.updated} skipped=${report.skipped} errors=${report.errors}`);
  logger(`sample=${JSON.stringify(report.sample)}`);

  return report;
}

async function runCli(): Promise<void> {
  try {
    const report = await runBackfillProvisioningSuccess();
    console.log(`BACKFILL_PROVISIONING_SUCCESS_REPORT ${JSON.stringify(report)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`BACKFILL_PROVISIONING_SUCCESS_ERROR ${message}`);
    process.exit(1);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
