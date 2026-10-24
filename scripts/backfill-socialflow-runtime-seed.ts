import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BackfillMode = "d1-local" | "fixtures";

type CoreSaasRow = {
  id: string;
  tenant_id: string;
  slug: string;
  name: string | null;
  domain: string | null;
  status: string | null;
  created_at: string | null;
};

type SeedMetadataRow = {
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

type RuntimeSeedEntry = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string;
  status: string;
  metadata_json: string;
};

type Operation = {
  key: string;
  type: "insert" | "update" | "unchanged";
  entry: RuntimeSeedEntry;
};

export type RuntimeSeedBackfillReport = {
  mode: BackfillMode;
  dryRun: boolean;
  scanned: number;
  selected: number;
  inserts: number;
  updates: number;
  unchanged: number;
};

type RunBackfillOptions = {
  dryRun?: boolean;
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

const SOCIALFLOW_RUNTIME_SEED_SLUGS = new Set(["socialflow", "socialflows"]);
const FIXTURE_SOURCE_FILE = "core-saas.json";
const FIXTURE_TARGET_FILE = "socialflow-seed-metadata.json";

function keyOf(tenantId: string, saasId: string, slug: string): string {
  return `${tenantId}::${saasId}::${slug.toLowerCase()}`;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function slugAllowed(value: string): boolean {
  return SOCIALFLOW_RUNTIME_SEED_SLUGS.has(normalizeSlug(value));
}

function slugPrimary(value: string): string {
  const lower = normalizeSlug(value);
  if (lower === "socialflows") return "socialflow";
  return lower;
}

function normalizeStatus(value: string | null | undefined): string {
  const raw = normalizeText(value);
  return raw.length > 0 ? raw.toLowerCase() : "active";
}

function toSeedId(tenantId: string, saasId: string, slug: string): string {
  const safe = `${tenantId}_${saasId}_${slug}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 48);
  return `sf_seed_${safe}`;
}

function metadataJsonFor(row: CoreSaasRow): string {
  return JSON.stringify({
    source: "core_saas_backfill",
    name: normalizeText(row.name) || null,
    createdAt: row.created_at ?? null,
  });
}

function selectLatestSeedPerTenant(rows: CoreSaasRow[]): RuntimeSeedEntry[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.tenant_id !== b.tenant_id) return a.tenant_id.localeCompare(b.tenant_id);
    const left = a.created_at ?? "";
    const right = b.created_at ?? "";
    if (left === right) return b.id.localeCompare(a.id);
    return right.localeCompare(left);
  });

  const picked = new Set<string>();
  const selected: RuntimeSeedEntry[] = [];

  for (const row of sorted) {
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.id);
    const slug = slugPrimary(row.slug);
    if (!tenantId || !saasId || !slugAllowed(row.slug)) continue;
    if (picked.has(tenantId)) continue;

    picked.add(tenantId);
    selected.push({
      id: toSeedId(tenantId, saasId, slug),
      tenant_id: tenantId,
      saas_id: saasId,
      slug,
      domain: normalizeText(row.domain),
      status: normalizeStatus(row.status),
      metadata_json: metadataJsonFor(row),
    });
  }

  return selected;
}

function equivalent(left: RuntimeSeedEntry, right: SeedMetadataRow): boolean {
  return (
    left.tenant_id === right.tenant_id
    && left.saas_id === right.saas_id
    && left.slug === normalizeSlug(right.slug)
    && left.domain === normalizeText(right.domain)
    && left.status === normalizeStatus(right.status)
    && left.metadata_json === normalizeText(right.metadata_json)
  );
}

function planOperations(selected: RuntimeSeedEntry[], existingRows: SeedMetadataRow[]): Operation[] {
  const existing = new Map<string, SeedMetadataRow>();
  for (const row of existingRows) {
    const key = keyOf(normalizeText(row.tenant_id), normalizeText(row.saas_id), normalizeText(row.slug));
    existing.set(key, row);
  }

  return selected.map((entry) => {
    const key = keyOf(entry.tenant_id, entry.saas_id, entry.slug);
    const current = existing.get(key);
    if (!current) {
      return { key, type: "insert", entry };
    }
    if (!equivalent(entry, current)) {
      return { key, type: "update", entry };
    }
    return { key, type: "unchanged", entry };
  });
}

function asSqlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function parseJsonRows<T>(jsonOutput: string): T[] {
  const parsed = JSON.parse(jsonOutput) as Array<{ results?: T[] }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }
  return parsed[0]?.results ?? [];
}

function runWranglerJson(
  binding: string,
  sql: string,
  options: { configPath: string },
): unknown[] {
  const output = execFileSync(
    "pnpm",
    [
      "wrangler",
      "d1",
      "execute",
      binding,
      "--local",
      "--config",
      options.configPath,
      "--command",
      sql,
      "--json",
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  return parseJsonRows(output);
}

function runWranglerCommand(
  binding: string,
  sql: string,
  options: { configPath: string },
): void {
  execFileSync(
    "pnpm",
    [
      "wrangler",
      "d1",
      "execute",
      binding,
      "--local",
      "--config",
      options.configPath,
      "--command",
      sql,
    ],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    },
  );
}

function assertSchema(rows: Array<{ name?: string }>, tableName: string): void {
  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_BACKFILL_TABLE_MISSING: ${tableName}`);
  }
}

async function runFixturesBackfill(
  fixturesDir: string,
  dryRun: boolean,
): Promise<RuntimeSeedBackfillReport> {
  const sourcePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_TARGET_FILE);

  const sourceRaw = await fs.readFile(sourcePath, "utf8");
  const targetRaw = await fs.readFile(targetPath, "utf8");

  const sourceRows = JSON.parse(sourceRaw) as CoreSaasRow[];
  const targetRows = JSON.parse(targetRaw) as SeedMetadataRow[];

  const selected = selectLatestSeedPerTenant(sourceRows);
  const operations = planOperations(selected, targetRows);

  if (!dryRun) {
    const now = new Date().toISOString();
    const nextRows = new Map<string, SeedMetadataRow>();
    for (const row of targetRows) {
      nextRows.set(keyOf(row.tenant_id, row.saas_id, row.slug), row);
    }

    for (const operation of operations) {
      if (operation.type === "unchanged") continue;
      const existing = nextRows.get(operation.key);
      if (existing) {
        nextRows.set(operation.key, {
          ...existing,
          domain: operation.entry.domain,
          status: operation.entry.status,
          metadata_json: operation.entry.metadata_json,
          updated_at: now,
        });
      } else {
        nextRows.set(operation.key, {
          id: operation.entry.id,
          tenant_id: operation.entry.tenant_id,
          saas_id: operation.entry.saas_id,
          slug: operation.entry.slug,
          domain: operation.entry.domain,
          status: operation.entry.status,
          metadata_json: operation.entry.metadata_json,
          created_at: now,
          updated_at: now,
        });
      }
    }

    const sorted = [...nextRows.values()].sort((a, b) =>
      keyOf(a.tenant_id, a.saas_id, a.slug).localeCompare(keyOf(b.tenant_id, b.saas_id, b.slug)),
    );
    await fs.writeFile(targetPath, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
  }

  return {
    mode: "fixtures",
    dryRun,
    scanned: sourceRows.length,
    selected: selected.length,
    inserts: operations.filter((entry) => entry.type === "insert").length,
    updates: operations.filter((entry) => entry.type === "update").length,
    unchanged: operations.filter((entry) => entry.type === "unchanged").length,
  };
}

async function runLocalD1Backfill(
  dryRun: boolean,
  options: { configPath: string; dracoBinding: string; socialBinding: string },
): Promise<RuntimeSeedBackfillReport> {
  const dracoTables = runWranglerJson(
    options.dracoBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'saas';",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  assertSchema(dracoTables, "saas");

  const socialTables = runWranglerJson(
    options.socialBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'socialflow_seed_metadata';",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  assertSchema(socialTables, "socialflow_seed_metadata");

  const sourceRows = runWranglerJson(
    options.dracoBinding,
    `SELECT id, tenant_id, slug, name, domain, status, created_at
     FROM saas
     WHERE tenant_id IS NOT NULL
       AND lower(slug) IN ('socialflow', 'socialflows')
     ORDER BY tenant_id ASC, datetime(created_at) DESC`,
    { configPath: options.configPath },
  ) as CoreSaasRow[];

  const existingRows = runWranglerJson(
    options.socialBinding,
    `SELECT id, tenant_id, saas_id, slug, domain, status, metadata_json, created_at, updated_at
     FROM socialflow_seed_metadata`,
    { configPath: options.configPath },
  ) as SeedMetadataRow[];

  const selected = selectLatestSeedPerTenant(sourceRows);
  const operations = planOperations(selected, existingRows);

  if (!dryRun) {
    const now = new Date().toISOString();
    for (const operation of operations) {
      if (operation.type === "unchanged") continue;

      const entry = operation.entry;
      const sql = `
        INSERT INTO socialflow_seed_metadata (
          id, tenant_id, saas_id, slug, domain, status, metadata_json, created_at, updated_at
        ) VALUES (
          ${asSqlValue(entry.id)},
          ${asSqlValue(entry.tenant_id)},
          ${asSqlValue(entry.saas_id)},
          ${asSqlValue(entry.slug)},
          ${asSqlValue(entry.domain)},
          ${asSqlValue(entry.status)},
          ${asSqlValue(entry.metadata_json)},
          ${asSqlValue(now)},
          ${asSqlValue(now)}
        )
        ON CONFLICT(tenant_id, saas_id, slug) DO UPDATE SET
          domain = excluded.domain,
          status = excluded.status,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
        WHERE socialflow_seed_metadata.domain IS NOT excluded.domain
           OR socialflow_seed_metadata.status IS NOT excluded.status
           OR socialflow_seed_metadata.metadata_json IS NOT excluded.metadata_json;
      `;
      runWranglerCommand(options.socialBinding, sql, { configPath: options.configPath });
    }
  }

  return {
    mode: "d1-local",
    dryRun,
    scanned: sourceRows.length,
    selected: selected.length,
    inserts: operations.filter((entry) => entry.type === "insert").length,
    updates: operations.filter((entry) => entry.type === "update").length,
    unchanged: operations.filter((entry) => entry.type === "unchanged").length,
  };
}

function parseArgs(argv: string[]): {
  dryRun: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  fixturesDir: string | null;
} {
  const dryRun = argv.includes("--dry-run");

  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));

  return {
    dryRun,
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
  };
}

export async function runBackfillSocialflowRuntimeSeed(options: RunBackfillOptions = {}): Promise<RuntimeSeedBackfillReport> {
  const dryRun = options.dryRun ?? false;
  const configPath = options.configPath ?? "wrangler.workers.toml";
  const dracoBinding = options.dracoBinding ?? "DRACO_DB";
  const socialBinding = options.socialBinding ?? "SOCIAL_DB";
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const log = options.log ?? console.log;

  const report = fixturesDir
    ? await runFixturesBackfill(fixturesDir, dryRun)
    : await runLocalD1Backfill(dryRun, { configPath, dracoBinding, socialBinding });

  log(`SOCIALFLOW_RUNTIME_SEED_BACKFILL mode=${report.mode} dryRun=${report.dryRun}`);
  log(
    `scanned=${report.scanned} selected=${report.selected} inserts=${report.inserts} updates=${report.updates} unchanged=${report.unchanged}`,
  );
  return report;
}

async function runCli(): Promise<void> {
  try {
    const parsed = parseArgs(process.argv.slice(2));
    const report = await runBackfillSocialflowRuntimeSeed({
      dryRun: parsed.dryRun,
      configPath: parsed.configPath,
      dracoBinding: parsed.dracoBinding,
      socialBinding: parsed.socialBinding,
      fixturesDir: parsed.fixturesDir,
    });
    console.log(`SOCIALFLOW_RUNTIME_SEED_BACKFILL_REPORT ${JSON.stringify(report)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_RUNTIME_SEED_BACKFILL_ERROR ${message}`);
    process.exit(1);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
