import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type BootstrapMode = "d1-local" | "fixtures";

type CoreSaasRow = {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  domain: string | null;
  status: string | null;
  blueprint_snapshot: string | null;
  created_at: string;
};

type SocialSeedRow = {
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

type CoreSeedSelection = {
  tenantId: string;
  saasId: string;
  slug: "socialflow" | "socialflows";
  inserted: boolean;
};

export type BootstrapSocialflowRuntimeSeedSmokeReport = {
  mode: BootstrapMode;
  dryRun: boolean;
  createdTables: string[];
  addedColumns: string[];
  insertedCoreSeeds: number;
  insertedSocialSeeds: number;
  ensuredAuthTables: string[];
  coreSeed: {
    tenantId: string;
    saasId: string;
    slug: string;
  } | null;
};

type BootstrapOptions = {
  dryRun?: boolean;
  configPath?: string;
  dracoBinding?: string;
  socialBinding?: string;
  authBinding?: string;
  tenantId?: string;
  coreSaasId?: string;
  coreSlug?: "socialflow" | "socialflows";
  coreName?: string;
  coreDomain?: string;
  fixturesDir?: string | null;
  log?: (line: string) => void;
};

type ParsedArgs = {
  dryRun: boolean;
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  authBinding: string;
  tenantId: string;
  coreSaasId: string;
  coreSlug: "socialflow" | "socialflows";
  coreName: string;
  coreDomain: string;
  fixturesDir: string | null;
};

const FIXTURE_CORE_FILE = "core-saas.json";
const FIXTURE_SOCIAL_FILE = "socialflow-seed-metadata.json";
const FIXTURE_SCHEMA_FILE = "bootstrap-socialflow-runtime-seed-schema.json";

const REQUIRED_MIGRATION_FILES = [
  "migrations/0001_init.sql",
  "migrations/0013_tenant_columns.sql",
  "migrations/0142_socialflow_auths.sql",
  "migrations/0187_socialflow_seed_metadata.sql",
] as const;

const REQUIRED_SAAS_COLUMNS = [
  "id",
  "tenant_id",
  "name",
  "slug",
  "domain",
  "status",
  "blueprint_snapshot",
  "created_at",
] as const;

const FALLBACK_CORE_SLUG: "socialflow" | "socialflows" = "socialflows";

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function nowIso(): string {
  return new Date().toISOString();
}

function asSqlValue(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function parseArgs(argv: string[]): ParsedArgs {
  const dryRun = argv.includes("--dry-run");

  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const authArg = argv.find((value) => value.startsWith("--auth-binding="));
  const tenantArg = argv.find((value) => value.startsWith("--tenant-id="));
  const saasArg = argv.find((value) => value.startsWith("--core-saas-id="));
  const slugArg = argv.find((value) => value.startsWith("--core-slug="));
  const nameArg = argv.find((value) => value.startsWith("--core-name="));
  const domainArg = argv.find((value) => value.startsWith("--core-domain="));
  const fixturesArg = argv.find((value) => value.startsWith("--fixtures-dir="));

  const parsedSlug = slugArg ? normalizeSlug(slugArg.slice("--core-slug=".length)) : "socialflow";
  if (parsedSlug !== "socialflow" && parsedSlug !== "socialflows") {
    throw new Error("SOCIALFLOW_RUNTIME_SEED_BOOTSTRAP_INVALID_CORE_SLUG");
  }

  return {
    dryRun,
    configPath: configArg ? configArg.slice("--config=".length) : "apps/socialflow-runtime/wrangler.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    authBinding: authArg ? authArg.slice("--auth-binding=".length) : "SOCIALFLOW_AUTHS_DB",
    tenantId: tenantArg ? tenantArg.slice("--tenant-id=".length) : "tenant_socialflow_runtime_seed_local",
    coreSaasId: saasArg ? saasArg.slice("--core-saas-id=".length) : "saas_socialflow_runtime_seed_local",
    coreSlug: parsedSlug,
    coreName: nameArg ? nameArg.slice("--core-name=".length) : "SocialFlow Runtime Seed Local",
    coreDomain: domainArg ? domainArg.slice("--core-domain=".length) : "socialflow-runtime-seed-local.internal",
    fixturesDir: fixturesArg ? fixturesArg.slice("--fixtures-dir=".length) : null,
  };
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

    const parsed = JSON.parse(output) as Array<{ results?: unknown[] }>;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [];
    }

    return parsed[0]?.results ?? [];
  } catch (error) {
    const commandError = error as { stderr?: string | Buffer; message?: string };
    const stderr = typeof commandError.stderr === "string"
      ? commandError.stderr
      : commandError.stderr instanceof Buffer
        ? commandError.stderr.toString("utf8")
        : commandError.message ?? String(error);
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_BOOTSTRAP_WRANGLER_JSON_FAILED:${stderr.trim()}`);
  }
}

function runWranglerCommand(binding: string, configPath: string, sql: string): void {
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
        "--command",
        sql,
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
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_BOOTSTRAP_WRANGLER_COMMAND_FAILED:${stderr.trim()}`);
  }
}

function tableExists(binding: string, configPath: string, tableName: string): boolean {
  const rows = runWranglerJson(
    binding,
    configPath,
    `SELECT name FROM sqlite_master WHERE type='table' AND name=${asSqlValue(tableName)};`,
  ) as Array<{ name?: string }>;

  return rows.some((row) => row.name === tableName);
}

function readTableColumns(binding: string, configPath: string, tableName: string): string[] {
  const rows = runWranglerJson(
    binding,
    configPath,
    `PRAGMA table_info(${asSqlValue(tableName)});`,
  ) as Array<{ name?: string }>;

  return rows
    .map((row) => row.name?.trim() ?? "")
    .filter((value) => value.length > 0);
}

function resolveExistingCoreSeedRow(rows: CoreSaasRow[], tenantId: string, slug: "socialflow" | "socialflows"): CoreSaasRow | null {
  return rows.find((row) => row.tenant_id === tenantId && normalizeSlug(row.slug) === slug) ?? null;
}

async function assertRequiredMigrationsPresent(): Promise<void> {
  for (const relativePath of REQUIRED_MIGRATION_FILES) {
    const absolutePath = path.resolve(process.cwd(), relativePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new Error(`SOCIALFLOW_RUNTIME_SEED_BOOTSTRAP_MIGRATION_MISSING:${relativePath}`);
    }
  }
}

function buildCoreSeedCandidates(primary: "socialflow" | "socialflows"): Array<"socialflow" | "socialflows"> {
  const secondary = primary === "socialflow" ? FALLBACK_CORE_SLUG : "socialflow";
  return [primary, secondary];
}

function defaultSocialSeedId(input: { tenantId: string; saasId: string; slug: string }): string {
  const base = `${input.tenantId}_${input.saasId}_${input.slug}`
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 42);
  return `sf_seed_${base}`;
}

function defaultSocialMetadataJson(coreName: string): string {
  return JSON.stringify({
    source: "socialflow_runtime_seed_smoke_local_bootstrap",
    name: coreName,
  });
}

async function runFixturesBootstrap(
  options: Required<Omit<BootstrapOptions, "log" | "fixturesDir">> & { fixturesDir: string; log: (line: string) => void },
): Promise<BootstrapSocialflowRuntimeSeedSmokeReport> {
  const schemaPath = path.resolve(process.cwd(), options.fixturesDir, FIXTURE_SCHEMA_FILE);
  const corePath = path.resolve(process.cwd(), options.fixturesDir, FIXTURE_CORE_FILE);
  const socialPath = path.resolve(process.cwd(), options.fixturesDir, FIXTURE_SOCIAL_FILE);

  const schemaRaw = await fs.readFile(schemaPath, "utf8");
  const coreRaw = await fs.readFile(corePath, "utf8");
  const socialRaw = await fs.readFile(socialPath, "utf8");

  const schema = JSON.parse(schemaRaw) as FixtureSchemaState;
  const coreRows = JSON.parse(coreRaw) as CoreSaasRow[];
  const socialRows = JSON.parse(socialRaw) as SocialSeedRow[];

  const report: BootstrapSocialflowRuntimeSeedSmokeReport = {
    mode: "fixtures",
    dryRun: options.dryRun,
    createdTables: [],
    addedColumns: [],
    insertedCoreSeeds: 0,
    insertedSocialSeeds: 0,
    ensuredAuthTables: [],
    coreSeed: null,
  };

  const nextSchema: FixtureSchemaState = JSON.parse(JSON.stringify(schema)) as FixtureSchemaState;
  const nextCoreRows = [...coreRows];
  const nextSocialRows = [...socialRows];

  if (!schema.draco.hasSaasTable) {
    report.createdTables.push("DRACO_DB.saas");
    if (!options.dryRun) {
      nextSchema.draco.hasSaasTable = true;
    }
  }

  const existingColumns = new Set(schema.draco.saasColumns.map((entry) => entry.trim()).filter(Boolean));
  for (const requiredColumn of REQUIRED_SAAS_COLUMNS) {
    if (existingColumns.has(requiredColumn)) continue;
    report.addedColumns.push(`DRACO_DB.saas.${requiredColumn}`);
    if (!options.dryRun) {
      nextSchema.draco.saasColumns.push(requiredColumn);
      existingColumns.add(requiredColumn);
    }
  }

  if (!schema.social.hasSeedTable) {
    report.createdTables.push("SOCIAL_DB.socialflow_seed_metadata");
    if (!options.dryRun) {
      nextSchema.social.hasSeedTable = true;
    }
  }

  const authTableFlags: Array<[boolean, keyof FixtureSchemaState["auth"], string]> = [
    [schema.auth.hasUsersTable, "hasUsersTable", "SOCIALFLOW_AUTHS_DB.socialflow_users"],
    [schema.auth.hasCredentialsTable, "hasCredentialsTable", "SOCIALFLOW_AUTHS_DB.socialflow_credentials"],
    [schema.auth.hasSessionsTable, "hasSessionsTable", "SOCIALFLOW_AUTHS_DB.socialflow_sessions"],
  ];
  for (const [present, key, tableName] of authTableFlags) {
    if (present) continue;
    report.ensuredAuthTables.push(tableName);
    if (!options.dryRun) {
      nextSchema.auth[key] = true;
    }
  }

  const candidateSlugs = buildCoreSeedCandidates(options.coreSlug);
  let selectedCore: CoreSeedSelection | null = null;
  for (const slug of candidateSlugs) {
    const row = resolveExistingCoreSeedRow(nextCoreRows, options.tenantId, slug);
    if (row) {
      selectedCore = {
        tenantId: row.tenant_id,
        saasId: row.id,
        slug,
        inserted: false,
      };
      break;
    }
  }

  if (!selectedCore) {
    const chosenSlug = candidateSlugs[0];
    selectedCore = {
      tenantId: options.tenantId,
      saasId: options.coreSaasId,
      slug: chosenSlug,
      inserted: true,
    };
    report.insertedCoreSeeds += 1;

    if (!options.dryRun) {
      nextCoreRows.push({
        id: options.coreSaasId,
        tenant_id: options.tenantId,
        name: options.coreName,
        slug: chosenSlug,
        domain: options.coreDomain,
        status: "active",
        blueprint_snapshot: null,
        created_at: nowIso(),
      });
    }
  }

  const socialMatch = nextSocialRows.find((row) => (
    row.tenant_id === selectedCore.tenantId
    && row.saas_id === selectedCore.saasId
    && normalizeSlug(row.slug) === selectedCore.slug
  ));

  if (!socialMatch) {
    report.insertedSocialSeeds += 1;
    if (!options.dryRun) {
      const timestamp = nowIso();
      nextSocialRows.push({
        id: defaultSocialSeedId({
          tenantId: selectedCore.tenantId,
          saasId: selectedCore.saasId,
          slug: selectedCore.slug,
        }),
        tenant_id: selectedCore.tenantId,
        saas_id: selectedCore.saasId,
        slug: selectedCore.slug,
        domain: options.coreDomain,
        status: "active",
        metadata_json: defaultSocialMetadataJson(options.coreName),
        created_at: timestamp,
        updated_at: timestamp,
      });
    }
  }

  if (!options.dryRun) {
    await fs.writeFile(schemaPath, `${JSON.stringify(nextSchema, null, 2)}\n`, "utf8");
    await fs.writeFile(corePath, `${JSON.stringify(nextCoreRows, null, 2)}\n`, "utf8");
    await fs.writeFile(socialPath, `${JSON.stringify(nextSocialRows, null, 2)}\n`, "utf8");
  }

  report.coreSeed = {
    tenantId: selectedCore.tenantId,
    saasId: selectedCore.saasId,
    slug: selectedCore.slug,
  };
  return report;
}

function runLocalD1Bootstrap(options: Required<Omit<BootstrapOptions, "fixturesDir" | "log">> & { log: (line: string) => void }): BootstrapSocialflowRuntimeSeedSmokeReport {
  const report: BootstrapSocialflowRuntimeSeedSmokeReport = {
    mode: "d1-local",
    dryRun: options.dryRun,
    createdTables: [],
    addedColumns: [],
    insertedCoreSeeds: 0,
    insertedSocialSeeds: 0,
    ensuredAuthTables: [],
    coreSeed: null,
  };

  const saasExists = tableExists(options.dracoBinding, options.configPath, "saas");
  let saasReadyForQueries = saasExists;
  if (!saasExists) {
    report.createdTables.push(`${options.dracoBinding}.saas`);
    if (!options.dryRun) {
      runWranglerCommand(
        options.dracoBinding,
        options.configPath,
        `CREATE TABLE IF NOT EXISTS saas (
          id TEXT PRIMARY KEY,
          tenant_id TEXT,
          name TEXT NOT NULL,
          slug TEXT NOT NULL UNIQUE,
          domain TEXT,
          status TEXT NOT NULL DEFAULT 'inactive',
          blueprint_snapshot TEXT,
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );`,
      );
      saasReadyForQueries = true;
    }
  }

  const saasColumns = saasReadyForQueries
    ? new Set(readTableColumns(options.dracoBinding, options.configPath, "saas"))
    : new Set<string>(REQUIRED_SAAS_COLUMNS);
  for (const required of ["id", "name", "slug", "domain", "status", "created_at"] as const) {
    if (!saasColumns.has(required)) {
      throw new Error(`SOCIALFLOW_RUNTIME_SEED_BOOTSTRAP_SAAS_COLUMN_MISSING:${required}`);
    }
  }

  if (!saasColumns.has("tenant_id")) {
    report.addedColumns.push(`${options.dracoBinding}.saas.tenant_id`);
    if (!options.dryRun) {
      runWranglerCommand(
        options.dracoBinding,
        options.configPath,
        "ALTER TABLE saas ADD COLUMN tenant_id TEXT DEFAULT 'demo-tenant';",
      );
      saasColumns.add("tenant_id");
    }
  }

  if (!saasColumns.has("blueprint_snapshot")) {
    report.addedColumns.push(`${options.dracoBinding}.saas.blueprint_snapshot`);
    if (!options.dryRun) {
      runWranglerCommand(
        options.dracoBinding,
        options.configPath,
        "ALTER TABLE saas ADD COLUMN blueprint_snapshot TEXT;",
      );
      saasColumns.add("blueprint_snapshot");
    }
  }

  const seedTableExists = tableExists(options.socialBinding, options.configPath, "socialflow_seed_metadata");
  let seedTableReadyForQueries = seedTableExists;
  if (!seedTableExists) {
    report.createdTables.push(`${options.socialBinding}.socialflow_seed_metadata`);
    if (!options.dryRun) {
      runWranglerCommand(
        options.socialBinding,
        options.configPath,
        `CREATE TABLE IF NOT EXISTS socialflow_seed_metadata (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          saas_id TEXT NOT NULL,
          slug TEXT NOT NULL,
          domain TEXT NOT NULL,
          status TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE (tenant_id, saas_id, slug)
        );`,
      );
      runWranglerCommand(
        options.socialBinding,
        options.configPath,
        "CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_tenant_id ON socialflow_seed_metadata (tenant_id);",
      );
      runWranglerCommand(
        options.socialBinding,
        options.configPath,
        "CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_saas_id ON socialflow_seed_metadata (saas_id);",
      );
      runWranglerCommand(
        options.socialBinding,
        options.configPath,
        "CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_slug ON socialflow_seed_metadata (slug);",
      );
      runWranglerCommand(
        options.socialBinding,
        options.configPath,
        "CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_domain ON socialflow_seed_metadata (domain);",
      );
      runWranglerCommand(
        options.socialBinding,
        options.configPath,
        "CREATE INDEX IF NOT EXISTS idx_socialflow_seed_metadata_status ON socialflow_seed_metadata (status);",
      );
      seedTableReadyForQueries = true;
    }
  }

  const authChecks: Array<{ table: string; key: string }> = [
    { table: "socialflow_users", key: "users" },
    { table: "socialflow_credentials", key: "credentials" },
    { table: "socialflow_sessions", key: "sessions" },
  ];

  const missingAuthTables = authChecks.filter((entry) => !tableExists(options.authBinding, options.configPath, entry.table));
  if (missingAuthTables.length > 0) {
    for (const entry of missingAuthTables) {
      report.ensuredAuthTables.push(`${options.authBinding}.${entry.table}`);
    }
    if (!options.dryRun) {
      runWranglerCommand(
        options.authBinding,
        options.configPath,
        `CREATE TABLE IF NOT EXISTS socialflow_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          role TEXT NOT NULL DEFAULT 'user',
          tenant_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        );
        CREATE TABLE IF NOT EXISTS socialflow_credentials (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL DEFAULT 'password',
          hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          iterations INTEGER NOT NULL,
          algo TEXT NOT NULL DEFAULT 'PBKDF2-SHA256',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          FOREIGN KEY (user_id) REFERENCES socialflow_users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS socialflow_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          tenant_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          issued_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
          FOREIGN KEY (user_id) REFERENCES socialflow_users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_socialflow_credentials_user_id ON socialflow_credentials(user_id);
        CREATE INDEX IF NOT EXISTS idx_socialflow_sessions_tenant_id ON socialflow_sessions(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_socialflow_sessions_user_id ON socialflow_sessions(user_id);`,
      );
    }
  }

  const candidateSlugs = buildCoreSeedCandidates(options.coreSlug);
  let selectedCore: CoreSeedSelection | null = null;
  const coreRows = saasReadyForQueries
    ? runWranglerJson(
      options.dracoBinding,
      options.configPath,
      `SELECT id, tenant_id, name, slug, domain, status, blueprint_snapshot, created_at
       FROM saas
       WHERE tenant_id IS NOT NULL AND lower(slug) IN ('socialflow', 'socialflows')
       ORDER BY datetime(created_at) DESC;`,
    ) as CoreSaasRow[]
    : [];

  for (const slug of candidateSlugs) {
    const existing = resolveExistingCoreSeedRow(coreRows, options.tenantId, slug);
    if (!existing) continue;
    selectedCore = {
      tenantId: existing.tenant_id,
      saasId: existing.id,
      slug,
      inserted: false,
    };
    break;
  }

  if (!selectedCore) {
    for (const slug of candidateSlugs) {
      const timestamp = nowIso();
      try {
        if (!options.dryRun) {
          runWranglerCommand(
            options.dracoBinding,
            options.configPath,
            `INSERT INTO saas (id, tenant_id, name, slug, domain, status, blueprint_snapshot, created_at)
             VALUES (
               ${asSqlValue(options.coreSaasId)},
               ${asSqlValue(options.tenantId)},
               ${asSqlValue(options.coreName)},
               ${asSqlValue(slug)},
               ${asSqlValue(options.coreDomain)},
               ${asSqlValue("active")},
               NULL,
               ${asSqlValue(timestamp)}
             );`,
          );
        }

        selectedCore = {
          tenantId: options.tenantId,
          saasId: options.coreSaasId,
          slug,
          inserted: true,
        };
        report.insertedCoreSeeds += 1;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/UNIQUE constraint failed/i.test(message)) {
          continue;
        }
        throw error;
      }
    }
  }

  if (!selectedCore) {
    const fallback = coreRows.find((row) => row.tenant_id && (normalizeSlug(row.slug) === "socialflow" || normalizeSlug(row.slug) === "socialflows"));
    if (!fallback) {
      throw new Error("SOCIALFLOW_RUNTIME_SEED_BOOTSTRAP_CORE_SEED_UNAVAILABLE");
    }
    selectedCore = {
      tenantId: fallback.tenant_id,
      saasId: fallback.id,
      slug: normalizeSlug(fallback.slug) === "socialflows" ? "socialflows" : "socialflow",
      inserted: false,
    };
  }

  const existingSocialSeed = seedTableReadyForQueries
    ? runWranglerJson(
      options.socialBinding,
      options.configPath,
      `SELECT id
       FROM socialflow_seed_metadata
       WHERE tenant_id = ${asSqlValue(selectedCore.tenantId)}
         AND saas_id = ${asSqlValue(selectedCore.saasId)}
         AND lower(slug) = ${asSqlValue(selectedCore.slug)}
       LIMIT 1;`,
    ) as Array<{ id?: string }>
    : [];

  if (!existingSocialSeed[0]?.id) {
    report.insertedSocialSeeds += 1;
    if (!options.dryRun) {
      const timestamp = nowIso();
      const metadataJson = defaultSocialMetadataJson(options.coreName);
      runWranglerCommand(
        options.socialBinding,
        options.configPath,
        `INSERT INTO socialflow_seed_metadata (
          id, tenant_id, saas_id, slug, domain, status, metadata_json, created_at, updated_at
        ) VALUES (
          ${asSqlValue(defaultSocialSeedId({
            tenantId: selectedCore.tenantId,
            saasId: selectedCore.saasId,
            slug: selectedCore.slug,
          }))},
          ${asSqlValue(selectedCore.tenantId)},
          ${asSqlValue(selectedCore.saasId)},
          ${asSqlValue(selectedCore.slug)},
          ${asSqlValue(options.coreDomain)},
          ${asSqlValue("active")},
          ${asSqlValue(metadataJson)},
          ${asSqlValue(timestamp)},
          ${asSqlValue(timestamp)}
        );`,
      );
    }
  }

  report.coreSeed = {
    tenantId: selectedCore.tenantId,
    saasId: selectedCore.saasId,
    slug: selectedCore.slug,
  };

  return report;
}

export async function runBootstrapSocialflowRuntimeSeedSmokeLocal(
  optionsInput: BootstrapOptions = {},
): Promise<BootstrapSocialflowRuntimeSeedSmokeReport> {
  const options: Required<Omit<BootstrapOptions, "log">> & { log: (line: string) => void } = {
    dryRun: optionsInput.dryRun ?? false,
    configPath: optionsInput.configPath ?? "apps/socialflow-runtime/wrangler.toml",
    dracoBinding: optionsInput.dracoBinding ?? "DRACO_DB",
    socialBinding: optionsInput.socialBinding ?? "SOCIAL_DB",
    authBinding: optionsInput.authBinding ?? "SOCIALFLOW_AUTHS_DB",
    tenantId: optionsInput.tenantId ?? "tenant_socialflow_runtime_seed_local",
    coreSaasId: optionsInput.coreSaasId ?? "saas_socialflow_runtime_seed_local",
    coreSlug: optionsInput.coreSlug ?? "socialflow",
    coreName: optionsInput.coreName ?? "SocialFlow Runtime Seed Local",
    coreDomain: optionsInput.coreDomain ?? "socialflow-runtime-seed-local.internal",
    fixturesDir: optionsInput.fixturesDir ?? process.env.FIXTURES_DIR ?? null,
    log: optionsInput.log ?? console.log,
  };

  await assertRequiredMigrationsPresent();

  let report: BootstrapSocialflowRuntimeSeedSmokeReport;
  if (options.fixturesDir) {
    report = await runFixturesBootstrap({
      ...options,
      fixturesDir: options.fixturesDir,
    });
  } else {
    report = runLocalD1Bootstrap(options);
  }

  options.log(`SOCIALFLOW_RUNTIME_SEED_SMOKE_BOOTSTRAP mode=${report.mode} dryRun=${report.dryRun}`);
  options.log(
    `createdTables=${report.createdTables.length} addedColumns=${report.addedColumns.length} insertedCoreSeeds=${report.insertedCoreSeeds} insertedSocialSeeds=${report.insertedSocialSeeds} ensuredAuthTables=${report.ensuredAuthTables.length}`,
  );
  if (report.coreSeed) {
    options.log(
      `coreSeed tenantId=${report.coreSeed.tenantId} saasId=${report.coreSeed.saasId} slug=${report.coreSeed.slug}`,
    );
  }

  return report;
}

export async function runBootstrapSocialflowRuntimeSeedSmokeLocalCli(argv: string[]): Promise<number> {
  try {
    const parsed = parseArgs(argv);
    const report = await runBootstrapSocialflowRuntimeSeedSmokeLocal({
      dryRun: parsed.dryRun,
      configPath: parsed.configPath,
      dracoBinding: parsed.dracoBinding,
      socialBinding: parsed.socialBinding,
      authBinding: parsed.authBinding,
      tenantId: parsed.tenantId,
      coreSaasId: parsed.coreSaasId,
      coreSlug: parsed.coreSlug,
      coreName: parsed.coreName,
      coreDomain: parsed.coreDomain,
      fixturesDir: parsed.fixturesDir,
    });
    console.log(`SOCIALFLOW_RUNTIME_SEED_SMOKE_BOOTSTRAP_REPORT ${JSON.stringify(report)}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_RUNTIME_SEED_SMOKE_BOOTSTRAP_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runBootstrapSocialflowRuntimeSeedSmokeLocalCli(process.argv.slice(2));
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
