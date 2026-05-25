import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkSocialflowNonprodCanaryConfig,
  type SocialflowNonprodCanaryConfigReport,
} from "./check-socialflow-nonprod-canary-config";

const DEFAULT_CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

const OFF_SWITCHES = [
  "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
] as const;

export const SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS = [
  {
    id: "0187",
    file: "migrations/0187_socialflow_seed_metadata.sql",
    tables: ["socialflow_seed_metadata"],
  },
  {
    id: "0188",
    file: "migrations/0188_socialflow_export_read_models.sql",
    tables: ["socialflow_export_read_models"],
  },
  {
    id: "0189",
    file: "migrations/0189_socialflow_oauth_connections.sql",
    tables: ["socialflow_oauth_connections"],
  },
  {
    id: "0190",
    file: "migrations/0190_socialflow_legacy_read_models.sql",
    tables: [
      "socialflow_legacy_strategic_dossiers",
      "socialflow_legacy_tenant_progress",
      "socialflow_legacy_agent_work_logs",
      "socialflow_legacy_repository_context",
    ],
  },
] as const;

export type SocialflowNonprodOwnershipMigrationMode = "dry-run" | "verify-only" | "apply";

export type SocialflowNonprodOwnershipRemoteCommand = {
  kind: "apply-migration" | "list-tables" | "pragma-table";
  databaseName: string;
  displayCommand: string;
  args: string[];
  migrationId?: string;
  migrationFile?: string;
  tableName?: string;
  touches: string;
};

export type SocialflowNonprodOwnershipMigrationPlan = {
  mode: SocialflowNonprodOwnershipMigrationMode;
  reports: SocialflowNonprodCanaryConfigReport[];
  socialDb: {
    binding: "SOCIAL_DB";
    databaseName: string;
    databaseId: string;
  };
  migrations: typeof SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS;
  expectedTables: string[];
  applyCommands: SocialflowNonprodOwnershipRemoteCommand[];
  verifyCommands: SocialflowNonprodOwnershipRemoteCommand[];
};

export type SocialflowNonprodOwnershipMigrationRunResult = {
  ok: boolean;
  mode: SocialflowNonprodOwnershipMigrationMode;
  status: "DRY_RUN" | "VERIFY_OK" | "APPLY_OK";
  socialDbName: string;
  socialDbId: string;
  appliedMigrations: string[];
  verifiedTables: string[];
  applyCommands: string[];
  verifyCommands: string[];
};

type CliOptions = {
  mode: SocialflowNonprodOwnershipMigrationMode;
  configPaths: string[];
};

type WranglerInvocation = {
  command: string;
  prefixArgs: string[];
};

type RemoteCommandRunner = (command: SocialflowNonprodOwnershipRemoteCommand) => string;

function hasProductiveToken(value: string): boolean {
  return /(^|[_\-\s])prod($|[_\-\s])/i.test(value);
}

function hasCanaryOrNonprodToken(value: string): boolean {
  return /(canary|nonprod|staging|preview)/i.test(value);
}

function assertSafeSocialDbName(databaseName: string): void {
  if (hasProductiveToken(databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_PRODUCTIVE_DB:${databaseName}`);
  }

  if (!hasCanaryOrNonprodToken(databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_NOT_CANARY_OR_NONPROD:${databaseName}`);
  }
}

function assertMigrationFilesExist(): void {
  for (const migration of SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS) {
    if (!existsSync(path.resolve(process.cwd(), migration.file))) {
      throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_FILE_MISSING:${migration.file}`);
    }
  }
}

function getBinding(
  report: SocialflowNonprodCanaryConfigReport,
  bindingName: string,
): { binding: string; databaseName: string; databaseId: string } {
  const binding = report.bindings.find((candidate) => candidate.binding === bindingName);
  if (!binding) {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }

  return binding;
}

function assertReportSafeForOwnershipMigrations(report: SocialflowNonprodCanaryConfigReport): void {
  if (report.status !== "NON_DEPLOYABLE_REAL_NONPROD_CONFIG") {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_UNSAFE_STATUS:${report.configPath}:${report.status}`);
  }

  if (report.placeholders.length > 0) {
    throw new Error(
      `SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_PLACEHOLDERS_BLOCKED:${report.configPath}:${report.placeholders.join(",")}`,
    );
  }

  if (report.deployable) {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_DEPLOYABLE_BLOCKED:${report.configPath}`);
  }

  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_ROLLBACK_NOT_OFF:${report.configPath}`);
  }

  for (const switchName of OFF_SWITCHES) {
    if (report.switches[switchName] !== "0") {
      throw new Error(
        `SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_SWITCH_NOT_OFF:${report.configPath}:${switchName}:${report.switches[switchName] ?? "missing"}`,
      );
    }
  }
}

function createApplyCommands(databaseName: string): SocialflowNonprodOwnershipRemoteCommand[] {
  return SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS.map((migration) => ({
    kind: "apply-migration",
    databaseName,
    displayCommand: `wrangler d1 execute ${databaseName} --remote --file ${migration.file}`,
    args: ["d1", "execute", databaseName, "--remote", "--file", migration.file],
    migrationId: migration.id,
    migrationFile: migration.file,
    touches: `migration ${migration.id} -> ${migration.tables.join(", ")}`,
  }));
}

function createVerifyCommands(databaseName: string, expectedTables: string[]): SocialflowNonprodOwnershipRemoteCommand[] {
  return [
    {
      kind: "list-tables",
      databaseName,
      displayCommand: `wrangler d1 execute ${databaseName} --remote --command "SELECT name FROM sqlite_master WHERE type='table';"`,
      args: [
        "d1",
        "execute",
        databaseName,
        "--remote",
        "--command",
        "SELECT name FROM sqlite_master WHERE type='table';",
      ],
      touches: "table catalog verification",
    },
    ...expectedTables.map((tableName) => ({
      kind: "pragma-table" as const,
      databaseName,
      displayCommand: `wrangler d1 execute ${databaseName} --remote --command "PRAGMA table_info(${tableName});"`,
      args: [
        "d1",
        "execute",
        databaseName,
        "--remote",
        "--command",
        `PRAGMA table_info(${tableName});`,
      ],
      tableName,
      touches: `schema verification for ${tableName}`,
    })),
  ];
}

export function createSocialflowNonprodOwnershipMigrationPlan(options: {
  mode?: SocialflowNonprodOwnershipMigrationMode;
  configPaths?: string[];
} = {}): SocialflowNonprodOwnershipMigrationPlan {
  const mode = options.mode ?? "dry-run";
  const configPaths = options.configPaths?.length ? options.configPaths : [...DEFAULT_CONFIG_PATHS];
  const reports = configPaths.map((configPath) => checkSocialflowNonprodCanaryConfig({ configPath }));

  if (reports.length === 0) {
    throw new Error("SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_CONFIG_MISSING");
  }

  assertMigrationFilesExist();

  for (const report of reports) {
    assertReportSafeForOwnershipMigrations(report);
  }

  const socialDbBindings = reports.map((report) => getBinding(report, "SOCIAL_DB"));
  const [firstSocialDb] = socialDbBindings;
  if (!firstSocialDb) {
    throw new Error("SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_SOCIAL_DB_MISSING");
  }

  assertSafeSocialDbName(firstSocialDb.databaseName);

  for (const binding of socialDbBindings) {
    if (binding.databaseName !== firstSocialDb.databaseName || binding.databaseId !== firstSocialDb.databaseId) {
      throw new Error(
        `SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_SOCIAL_DB_CONFIG_MISMATCH:${binding.databaseName}:${binding.databaseId}`,
      );
    }
  }

  const expectedTables = SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS.flatMap((migration) => [...migration.tables]);
  return {
    mode,
    reports,
    socialDb: {
      binding: "SOCIAL_DB",
      databaseName: firstSocialDb.databaseName,
      databaseId: firstSocialDb.databaseId,
    },
    migrations: SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS,
    expectedTables,
    applyCommands: createApplyCommands(firstSocialDb.databaseName),
    verifyCommands: createVerifyCommands(firstSocialDb.databaseName, expectedTables),
  };
}

function resolveWranglerInvocation(): WranglerInvocation {
  const wranglerJs = path.resolve(process.cwd(), "node_modules/wrangler/bin/wrangler.js");
  if (existsSync(wranglerJs)) {
    return {
      command: process.execPath,
      prefixArgs: [wranglerJs],
    };
  }

  return {
    command: "wrangler",
    prefixArgs: [],
  };
}

function defaultRemoteCommandRunner(command: SocialflowNonprodOwnershipRemoteCommand): string {
  const wrangler = resolveWranglerInvocation();
  return execFileSync(wrangler.command, [...wrangler.prefixArgs, ...command.args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function printRemotePrecheck(command: SocialflowNonprodOwnershipRemoteCommand): void {
  console.log("SOCIALFLOW_NONPROD_REMOTE_COMMAND_PRECHECK");
  console.log(JSON.stringify({
    command: command.displayCommand,
    databaseName: command.databaseName,
    databaseContainsProd: hasProductiveToken(command.databaseName),
    databasePosture: "canary/nonprod",
    isDeploy: false,
    activatesSwitches: false,
    touches: command.touches,
  }, null, 2));
}

function assertRemoteCommandStillSafe(command: SocialflowNonprodOwnershipRemoteCommand): void {
  assertSafeSocialDbName(command.databaseName);

  if (!command.args.includes("--remote")) {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_REMOTE_FLAG_MISSING:${command.displayCommand}`);
  }

  if (command.args.includes("deploy")) {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_DEPLOY_COMMAND_BLOCKED:${command.displayCommand}`);
  }
}

function runRemoteCommand(
  command: SocialflowNonprodOwnershipRemoteCommand,
  runner: RemoteCommandRunner,
): string {
  assertRemoteCommandStillSafe(command);
  printRemotePrecheck(command);
  return runner(command);
}

function outputMentionsTable(output: string, tableName: string): boolean {
  return new RegExp(`(^|[^A-Za-z0-9_])${tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9_]|$)`).test(output);
}

function verifyTableListOutput(output: string, expectedTables: string[]): string[] {
  const missingTables = expectedTables.filter((tableName) => !outputMentionsTable(output, tableName));
  if (missingTables.length > 0) {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_TABLES_MISSING:${missingTables.join(",")}`);
  }

  return expectedTables;
}

function verifyPragmaOutput(output: string, tableName: string): void {
  const normalized = output.trim();
  if (!normalized || normalized === "[]" || normalized === "{}") {
    throw new Error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_PRAGMA_EMPTY:${tableName}`);
  }
}

export function executeSocialflowNonprodOwnershipMigrations(
  plan: SocialflowNonprodOwnershipMigrationPlan,
  runner: RemoteCommandRunner = defaultRemoteCommandRunner,
): SocialflowNonprodOwnershipMigrationRunResult {
  if (plan.mode === "dry-run") {
    return {
      ok: true,
      mode: plan.mode,
      status: "DRY_RUN",
      socialDbName: plan.socialDb.databaseName,
      socialDbId: plan.socialDb.databaseId,
      appliedMigrations: [],
      verifiedTables: [],
      applyCommands: plan.applyCommands.map((command) => command.displayCommand),
      verifyCommands: plan.verifyCommands.map((command) => command.displayCommand),
    };
  }

  const appliedMigrations: string[] = [];
  if (plan.mode === "apply") {
    for (const command of plan.applyCommands) {
      runRemoteCommand(command, runner);
      if (command.migrationId) {
        appliedMigrations.push(command.migrationId);
      }
    }
  }

  const [tableListCommand, ...pragmaCommands] = plan.verifyCommands;
  if (!tableListCommand) {
    throw new Error("SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_VERIFY_COMMAND_MISSING");
  }

  const tableListOutput = runRemoteCommand(tableListCommand, runner);
  const verifiedTables = verifyTableListOutput(tableListOutput, plan.expectedTables);

  for (const command of pragmaCommands) {
    const output = runRemoteCommand(command, runner);
    verifyPragmaOutput(output, command.tableName ?? "unknown");
  }

  return {
    ok: true,
    mode: plan.mode,
    status: plan.mode === "apply" ? "APPLY_OK" : "VERIFY_OK",
    socialDbName: plan.socialDb.databaseName,
    socialDbId: plan.socialDb.databaseId,
    appliedMigrations,
    verifiedTables,
    applyCommands: plan.applyCommands.map((command) => command.displayCommand),
    verifyCommands: plan.verifyCommands.map((command) => command.displayCommand),
  };
}

function parseArgs(argv: string[]): CliOptions {
  const apply = argv.includes("--apply");
  const verifyOnly = argv.includes("--verify-only");
  const dryRun = argv.includes("--dry-run");
  const selectedModes = [apply, verifyOnly, dryRun].filter(Boolean).length;

  if (selectedModes > 1) {
    throw new Error("SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_MODE_CONFLICT");
  }

  const mode: SocialflowNonprodOwnershipMigrationMode = apply ? "apply" : verifyOnly ? "verify-only" : "dry-run";
  const configPaths = argv
    .filter((arg) => arg.startsWith("--config="))
    .map((arg) => arg.slice("--config=".length));

  return {
    mode,
    configPaths: configPaths.length > 0 ? configPaths : [...DEFAULT_CONFIG_PATHS],
  };
}

export function runApplySocialflowNonprodOwnershipMigrationsCli(argv: string[]): number {
  try {
    const options = parseArgs(argv);
    const plan = createSocialflowNonprodOwnershipMigrationPlan(options);
    const result = executeSocialflowNonprodOwnershipMigrations(plan);
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    console.log(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_${result.status}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  const exitCode = runApplySocialflowNonprodOwnershipMigrationsCli(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
