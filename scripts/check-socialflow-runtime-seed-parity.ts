import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ParityMode = "d1-local" | "fixtures";

type CoreSaasRow = {
  id: string;
  tenant_id: string;
  slug: string;
  domain: string | null;
  status: string | null;
  created_at: string | null;
};

type SeedMetadataRow = {
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string | null;
  status: string | null;
};

type SeedComparable = {
  tenant_id: string;
  saas_id: string;
  slug: string;
  domain: string;
  status: string;
};

type Mismatch = {
  key: string;
  core: SeedComparable;
  social: SeedComparable;
  fields: Array<"domain" | "status">;
};

export type RuntimeSeedParityReport = {
  mode: ParityMode;
  totalCore: number;
  totalSocial: number;
  matched: number;
  missingInSocial: SeedComparable[];
  missingInCore: SeedComparable[];
  mismatched: Mismatch[];
};

type RunParityOptions = {
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

type ParsedArgs = {
  allowDrift: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  fixturesDir: string | null;
};

const SOCIALFLOW_RUNTIME_SEED_SLUGS = new Set(["socialflow", "socialflows"]);
const FIXTURE_SOURCE_FILE = "core-saas.json";
const FIXTURE_TARGET_FILE = "socialflow-seed-metadata.json";

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

function seedKey(value: SeedComparable): string {
  return `${value.tenant_id}::${value.saas_id}::${value.slug}`;
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

function assertTableExists(rows: Array<{ name?: string }>, tableName: string): void {
  if (!rows.some((row) => row.name === tableName)) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_PARITY_TABLE_MISSING: ${tableName}`);
  }
}

function selectLatestSeedPerTenant(rows: CoreSaasRow[]): SeedComparable[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.tenant_id !== b.tenant_id) return a.tenant_id.localeCompare(b.tenant_id);
    const left = a.created_at ?? "";
    const right = b.created_at ?? "";
    if (left === right) return b.id.localeCompare(a.id);
    return right.localeCompare(left);
  });

  const picked = new Set<string>();
  const selected: SeedComparable[] = [];

  for (const row of sorted) {
    const tenantId = normalizeText(row.tenant_id);
    const saasId = normalizeText(row.id);
    if (!tenantId || !saasId || !slugAllowed(row.slug)) continue;
    if (picked.has(tenantId)) continue;

    picked.add(tenantId);
    selected.push({
      tenant_id: tenantId,
      saas_id: saasId,
      slug: slugPrimary(row.slug),
      domain: normalizeText(row.domain),
      status: normalizeStatus(row.status),
    });
  }

  return selected;
}

function normalizeSocialRows(rows: SeedMetadataRow[]): SeedComparable[] {
  return rows
    .filter((row) => {
      const slug = normalizeText(row.slug);
      return slug.length > 0 && slugAllowed(slug);
    })
    .map((row) => ({
      tenant_id: normalizeText(row.tenant_id),
      saas_id: normalizeText(row.saas_id),
      slug: slugPrimary(row.slug),
      domain: normalizeText(row.domain),
      status: normalizeStatus(row.status),
    }))
    .filter((row) => row.tenant_id.length > 0 && row.saas_id.length > 0);
}

function buildParityReport(coreRows: SeedComparable[], socialRows: SeedComparable[], mode: ParityMode): RuntimeSeedParityReport {
  const coreMap = new Map<string, SeedComparable>();
  const socialMap = new Map<string, SeedComparable>();

  for (const row of coreRows) {
    coreMap.set(seedKey(row), row);
  }
  for (const row of socialRows) {
    socialMap.set(seedKey(row), row);
  }

  const missingInSocial: SeedComparable[] = [];
  const missingInCore: SeedComparable[] = [];
  const mismatched: Mismatch[] = [];
  let matched = 0;

  for (const [key, core] of coreMap.entries()) {
    const social = socialMap.get(key);
    if (!social) {
      missingInSocial.push(core);
      continue;
    }

    const fields: Array<"domain" | "status"> = [];
    if (core.domain !== social.domain) fields.push("domain");
    if (core.status !== social.status) fields.push("status");

    if (fields.length > 0) {
      mismatched.push({ key, core, social, fields });
    } else {
      matched += 1;
    }
  }

  for (const [key, social] of socialMap.entries()) {
    if (!coreMap.has(key)) {
      missingInCore.push(social);
    }
  }

  return {
    mode,
    totalCore: coreMap.size,
    totalSocial: socialMap.size,
    matched,
    missingInSocial,
    missingInCore,
    mismatched,
  };
}

function hasDrift(report: RuntimeSeedParityReport): boolean {
  return report.missingInSocial.length > 0 || report.missingInCore.length > 0 || report.mismatched.length > 0;
}

function stringifySeedList(rows: SeedComparable[]): string {
  return rows.map((row) => `${row.tenant_id}/${row.saas_id}/${row.slug} domain=${row.domain} status=${row.status}`).join(" | ");
}

function stringifyMismatches(rows: Mismatch[]): string {
  return rows
    .map((row) => `${row.key} fields=${row.fields.join(",")} core(domain=${row.core.domain},status=${row.core.status}) social(domain=${row.social.domain},status=${row.social.status})`)
    .join(" | ");
}

function reportToConsole(report: RuntimeSeedParityReport, log: (line: string) => void): void {
  log(`SOCIALFLOW_RUNTIME_SEED_PARITY mode=${report.mode}`);
  log(
    `core=${report.totalCore} social=${report.totalSocial} matched=${report.matched} missingInSocial=${report.missingInSocial.length} missingInCore=${report.missingInCore.length} mismatched=${report.mismatched.length}`,
  );
  if (report.missingInSocial.length > 0) {
    log(`missingInSocial=${stringifySeedList(report.missingInSocial)}`);
  }
  if (report.missingInCore.length > 0) {
    log(`missingInCore=${stringifySeedList(report.missingInCore)}`);
  }
  if (report.mismatched.length > 0) {
    log(`mismatched=${stringifyMismatches(report.mismatched)}`);
  }
}

async function loadFromFixtures(fixturesDir: string): Promise<RuntimeSeedParityReport> {
  const sourcePath = path.resolve(process.cwd(), fixturesDir, FIXTURE_SOURCE_FILE);
  const targetPath = path.resolve(process.cwd(), fixturesDir, FIXTURE_TARGET_FILE);
  const sourceRaw = await fs.readFile(sourcePath, "utf8");
  const targetRaw = await fs.readFile(targetPath, "utf8");

  const sourceRows = JSON.parse(sourceRaw) as CoreSaasRow[];
  const targetRows = JSON.parse(targetRaw) as SeedMetadataRow[];
  const coreSelected = selectLatestSeedPerTenant(sourceRows);
  const socialSelected = normalizeSocialRows(targetRows);

  return buildParityReport(coreSelected, socialSelected, "fixtures");
}

function loadFromLocalD1(options: { configPath: string; dracoBinding: string; socialBinding: string }): RuntimeSeedParityReport {
  const dracoTables = runWranglerJson(
    options.dracoBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'saas';",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  assertTableExists(dracoTables, "saas");

  const socialTables = runWranglerJson(
    options.socialBinding,
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'socialflow_seed_metadata';",
    { configPath: options.configPath },
  ) as Array<{ name?: string }>;
  assertTableExists(socialTables, "socialflow_seed_metadata");

  const sourceRows = runWranglerJson(
    options.dracoBinding,
    `SELECT id, tenant_id, slug, domain, status, created_at
     FROM saas
     WHERE tenant_id IS NOT NULL
       AND lower(slug) IN ('socialflow', 'socialflows')
     ORDER BY tenant_id ASC, datetime(created_at) DESC`,
    { configPath: options.configPath },
  ) as CoreSaasRow[];

  const targetRows = runWranglerJson(
    options.socialBinding,
    `SELECT tenant_id, saas_id, slug, domain, status
     FROM socialflow_seed_metadata`,
    { configPath: options.configPath },
  ) as SeedMetadataRow[];

  const coreSelected = selectLatestSeedPerTenant(sourceRows);
  const socialSelected = normalizeSocialRows(targetRows);

  return buildParityReport(coreSelected, socialSelected, "d1-local");
}

function parseArgs(argv: string[]): ParsedArgs {
  const allowDrift = argv.includes("--allow-drift");
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));

  return {
    allowDrift,
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
  };
}

export async function runCheckSocialflowRuntimeSeedParity(options: RunParityOptions = {}): Promise<RuntimeSeedParityReport> {
  const configPath = options.configPath ?? "wrangler.workers.toml";
  const dracoBinding = options.dracoBinding ?? "DRACO_DB";
  const socialBinding = options.socialBinding ?? "SOCIAL_DB";
  const fixturesDir = options.fixturesDir ?? process.env.FIXTURES_DIR ?? null;
  const log = options.log ?? console.log;

  const report = fixturesDir
    ? await loadFromFixtures(fixturesDir)
    : loadFromLocalD1({ configPath, dracoBinding, socialBinding });

  reportToConsole(report, log);
  return report;
}

export function resolveParityExitCode(report: RuntimeSeedParityReport, allowDrift: boolean): number {
  if (!hasDrift(report)) {
    return 0;
  }
  return allowDrift ? 0 : 2;
}

export async function runCheckSocialflowRuntimeSeedParityCli(
  argv: string[],
  io: { log: (line: string) => void; error: (line: string) => void } = {
    log: console.log,
    error: console.error,
  },
): Promise<number> {
  const args = parseArgs(argv);
  try {
    const report = await runCheckSocialflowRuntimeSeedParity({
      configPath: args.configPath,
      dracoBinding: args.dracoBinding,
      socialBinding: args.socialBinding,
      fixturesDir: args.fixturesDir,
      log: io.log,
    });

    const exitCode = resolveParityExitCode(report, args.allowDrift);
    if (exitCode !== 0) {
      io.error("SOCIALFLOW_RUNTIME_SEED_PARITY_DRIFT_DETECTED");
    }
    if (hasDrift(report) && args.allowDrift) {
      io.log("SOCIALFLOW_RUNTIME_SEED_PARITY_ALLOW_DRIFT=true");
    }
    return exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.error(`SOCIALFLOW_RUNTIME_SEED_PARITY_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runCheckSocialflowRuntimeSeedParityCli(process.argv.slice(2));
  if (code !== 0) {
    process.exit(code);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
