import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BootstrapMode = "d1-local" | "fixtures";

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

type BootstrapOptions = {
  dryRun?: boolean;
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

type ParsedArgs = {
  dryRun: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  fixturesDir: string | null;
};

export type BootstrapSocialflowLegacyReadModelsSmokeReport = {
  mode: BootstrapMode;
  dryRun: boolean;
  migrationApplied: boolean;
  createdTables: string[];
  ensuredTables: string[];
  configPath: string;
  socialBinding: string;
};

const REQUIRED_MIGRATION = "migrations/0190_socialflow_legacy_read_models.sql";
const FIXTURE_SCHEMA_FILE = "socialflow-legacy-backfill-schema.json";
const REQUIRED_SOCIAL_TABLES = [
  "socialflow_legacy_strategic_dossiers",
  "socialflow_legacy_tenant_progress",
  "socialflow_legacy_agent_work_logs",
  "socialflow_legacy_repository_context",
] as const;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asSqlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function parseJsonRows<T>(jsonOutput: string): T[] {
  const parsed = JSON.parse(jsonOutput) as Array<{ results?: T[] }>;
  if (!Array.isArray(parsed) || parsed.length === 0) return [];
  return parsed[0]?.results ?? [];
}

function parseArgs(argv: string[]): ParsedArgs {
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

async function assertRequiredMigrationExists(): Promise<void> {
  const migrationPath = path.resolve(process.cwd(), REQUIRED_MIGRATION);
  try {
    await fs.access(migrationPath);
  } catch {
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_MIGRATION_MISSING:${REQUIRED_MIGRATION}`);
  }
}

function runWranglerJson(binding: string, configPath: string, sql: string): unknown[] {
  try {
    const output = execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding,
        "--local",
        "--config",
        configPath,
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
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function runWranglerMigrationFile(binding: string, configPath: string, migrationPath: string): void {
  try {
    execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding,
        "--local",
        "--config",
        configPath,
        "--file",
        migrationPath,
      ],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_WRANGLER_MIGRATION_FAILED:${stderr.trim()}`);
  }
}

function ensureLocalBinding(binding: string, configPath: string, bindingName: string): void {
  try {
    runWranglerJson(binding, configPath, "SELECT 1 AS ok;");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:${bindingName}:${message}`);
  }
}

function listSocialTables(binding: string, configPath: string): string[] {
  const rows = runWranglerJson(
    binding,
    configPath,
    `SELECT name
     FROM sqlite_master
     WHERE type='table'
       AND name IN (${REQUIRED_SOCIAL_TABLES.map((tableName) => asSqlValue(tableName)).join(", ")});`,
  ) as Array<{ name?: string }>;

  return rows
    .map((row) => normalizeText(row.name))
    .filter((value) => value.length > 0);
}

function ensureSchemaGuaranteed(
  availableTables: string[],
  dryRun: boolean,
): { missingTables: string[]; ensuredTables: string[] } {
  const available = new Set(availableTables);
  const missingTables = REQUIRED_SOCIAL_TABLES.filter((tableName) => !available.has(tableName));
  const ensuredTables = REQUIRED_SOCIAL_TABLES.filter((tableName) => available.has(tableName));

  if (!dryRun && missingTables.length > 0) {
    throw new Error(
      `SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_TABLE_MISSING:${missingTables.join(",")}`,
    );
  }

  return { missingTables, ensuredTables };
}

async function runFixturesBootstrap(
  options: Required<Omit<BootstrapOptions, "fixturesDir" | "log">> & {
    fixturesDir: string;
    log: (line: string) => void;
  },
): Promise<BootstrapSocialflowLegacyReadModelsSmokeReport> {
  const schemaPath = path.resolve(process.cwd(), options.fixturesDir, FIXTURE_SCHEMA_FILE);
  const schemaRaw = await fs.readFile(schemaPath, "utf8");
  const schema = JSON.parse(schemaRaw) as FixtureSchema;

  if (!schema.bindings.draco) {
    throw new Error("SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:DRACO_DB");
  }
  if (!schema.bindings.social) {
    throw new Error("SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_BINDING_MISSING:SOCIAL_DB");
  }

  const before = new Set((schema.social.tables ?? []).map((table) => normalizeText(table)).filter(Boolean));
  const missingBefore = REQUIRED_SOCIAL_TABLES.filter((tableName) => !before.has(tableName));
  const createdTables = missingBefore.map((tableName) => `SOCIAL_DB.${tableName}`);

  if (!options.dryRun && missingBefore.length > 0) {
    schema.social.tables = [...before, ...missingBefore].sort((a, b) => a.localeCompare(b));
    await fs.writeFile(schemaPath, `${JSON.stringify(schema, null, 2)}\n`, "utf8");
  }

  const after = options.dryRun
    ? [...before]
    : [...new Set((schema.social.tables ?? []).map((table) => normalizeText(table)).filter(Boolean))];
  const { ensuredTables } = ensureSchemaGuaranteed(after, options.dryRun);
  if (options.dryRun && missingBefore.length > 0) {
    options.log(`dryRunMissingTables=${missingBefore.join(",")}`);
  }

  return {
    mode: "fixtures",
    dryRun: options.dryRun,
    migrationApplied: !options.dryRun,
    createdTables,
    ensuredTables,
    configPath: options.configPath,
    socialBinding: options.socialBinding,
  };
}

async function runLocalBootstrap(
  options: Required<Omit<BootstrapOptions, "fixturesDir" | "log">> & { log: (line: string) => void },
): Promise<BootstrapSocialflowLegacyReadModelsSmokeReport> {
  await assertRequiredMigrationExists();

  ensureLocalBinding(options.dracoBinding, options.configPath, "DRACO_DB");
  ensureLocalBinding(options.socialBinding, options.configPath, "SOCIAL_DB");

  const beforeTables = listSocialTables(options.socialBinding, options.configPath);
  if (!options.dryRun) {
    runWranglerMigrationFile(options.socialBinding, options.configPath, REQUIRED_MIGRATION);
  }

  const afterTables = options.dryRun
    ? beforeTables
    : listSocialTables(options.socialBinding, options.configPath);
  const beforeSet = new Set(beforeTables);
  const afterSet = new Set(afterTables);
  const createdTables = REQUIRED_SOCIAL_TABLES
    .filter((tableName) => !beforeSet.has(tableName) && afterSet.has(tableName))
    .map((tableName) => `SOCIAL_DB.${tableName}`);

  const { missingTables, ensuredTables } = ensureSchemaGuaranteed(afterTables, options.dryRun);
  if (options.dryRun && missingTables.length > 0) {
    options.log(`dryRunMissingTables=${missingTables.join(",")}`);
  }

  return {
    mode: "d1-local",
    dryRun: options.dryRun,
    migrationApplied: !options.dryRun,
    createdTables,
    ensuredTables,
    configPath: options.configPath,
    socialBinding: options.socialBinding,
  };
}

export async function runBootstrapSocialflowLegacyReadModelsSmokeLocal(
  options: BootstrapOptions = {},
): Promise<BootstrapSocialflowLegacyReadModelsSmokeReport> {
  const resolved = {
    dryRun: options.dryRun ?? false,
    configPath: options.configPath ?? "wrangler.workers.toml",
    dracoBinding: options.dracoBinding ?? "DRACO_DB",
    socialBinding: options.socialBinding ?? "SOCIAL_DB",
    fixturesDir: options.fixturesDir ?? null,
    log: options.log ?? console.log,
  };

  if (resolved.fixturesDir) {
    return runFixturesBootstrap({
      ...resolved,
      fixturesDir: resolved.fixturesDir,
    });
  }
  return runLocalBootstrap(resolved);
}

export async function runBootstrapSocialflowLegacyReadModelsSmokeLocalCli(argv: string[]): Promise<number> {
  try {
    const args = parseArgs(argv);
    const report = await runBootstrapSocialflowLegacyReadModelsSmokeLocal(args);
    console.log(JSON.stringify(report, null, 2));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_LEGACY_READ_MODELS_SMOKE_BOOTSTRAP_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runBootstrapSocialflowLegacyReadModelsSmokeLocalCli(process.argv.slice(2));
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
