import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkSocialflowNonprodCanaryConfig,
  type SocialflowNonprodCanaryConfigReport,
} from "./check-socialflow-nonprod-canary-config";
import {
  runBootstrapSocialflowNonprodSourceData,
  type SocialflowNonprodSourceBootstrapReport,
} from "./bootstrap-socialflow-nonprod-source-data";
import {
  runBackfillSocialflowNonprodOwnershipReadModels,
  type SocialflowNonprodOwnershipBackfillReport,
} from "./backfill-socialflow-nonprod-ownership-read-models";
import {
  runCheckSocialflowNonprodOwnershipParity,
  type SocialflowNonprodOwnershipParityReport,
} from "./check-socialflow-nonprod-ownership-parity";

const DEFAULT_CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

const REQUIRED_BINDINGS = ["DRACO_DB", "SAASES_DB", "SOCIAL_DB", "SOCIALFLOW_AUTHS_DB"] as const;
const OFF_SWITCHES = [
  "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
] as const;
const REQUIRED_SKIPPED_OAUTH_TOKENS = [
  "socialflow_oauth_connections",
  "drako_integration_connections",
  "drako_integration_credentials",
  "tokens",
  "credentials",
  "authMeta",
] as const;
const READ_ONLY_SQL_FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|UPSERT|MERGE|TRUNCATE|VACUUM|ATTACH|DETACH)\b/i;
const FORBIDDEN_SENSITIVE_TOKENS = [
  "socialflow_oauth_connections",
  "drako_integration_connections",
  "drako_integration_credentials",
  "authmeta",
  "auth_meta",
  "credential",
  "credentials",
  "encrypted_access_token",
  "encrypted_refresh_token",
  "encrypted_id_token",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
] as const;
const DB_ACCESS_SQL = "SELECT 1 AS ok;";
const NEXT_PHASE_RECOMMENDATION = "activate-only-SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH";

type CanaryBinding = SocialflowNonprodCanaryConfigReport["bindings"][number];

export type SocialflowNonprodSmokeDbAccessReport = {
  binding: string;
  databaseName: string;
  databaseId: string;
  accessible: true;
  sql: string;
  rowCount: number;
};

export type SocialflowNonprodCanarySwitchesOffSmokeReport = {
  ok: true;
  status: "SMOKE_OK";
  configReports: SocialflowNonprodCanaryConfigReport[];
  databaseAccess: SocialflowNonprodSmokeDbAccessReport[];
  sourceVerify: SocialflowNonprodSourceBootstrapReport;
  ownershipVerify: SocialflowNonprodOwnershipBackfillReport;
  parity: SocialflowNonprodOwnershipParityReport;
  oauthExcluded: true;
  oauthTouchedDatabases: [];
  remoteWrites: 0;
  touchedDatabases: string[];
  readyForNextPhase: true;
  nextPhaseRecommendation: typeof NEXT_PHASE_RECOMMENDATION;
};

type SmokeOptions = {
  configPaths?: string[];
};

type SmokeDependencies = {
  checkConfig?: (options: { configPath: string }) => SocialflowNonprodCanaryConfigReport;
  checkDatabaseAccess?: (binding: CanaryBinding) => SocialflowNonprodSmokeDbAccessReport;
  runSourceVerify?: (options: {
    mode: "verify-only";
    configPaths: string[];
  }) => Promise<SocialflowNonprodSourceBootstrapReport>;
  runOwnershipVerify?: (options: {
    mode: "verify-only";
    configPaths: string[];
  }) => Promise<SocialflowNonprodOwnershipBackfillReport>;
  runParity?: (options: {
    configPaths: string[];
  }) => Promise<SocialflowNonprodOwnershipParityReport>;
};

function hasProductiveToken(value: string): boolean {
  return /(^|[_\-\s])prod($|[_\-\s])/i.test(value);
}

function hasCanaryOrNonprodToken(value: string): boolean {
  return /(canary|nonprod|staging|preview)/i.test(value);
}

function assertNoSensitiveTokens(text: string): void {
  const lowered = text.toLowerCase();
  const forbidden = FORBIDDEN_SENSITIVE_TOKENS.find((token) => lowered.includes(token));
  if (forbidden) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_FORBIDDEN_TOKEN:${forbidden}`);
  }
}

export function assertSafeSocialflowNonprodSwitchesOffSmokeSql(sql: string): void {
  const trimmed = sql.trim();
  if (!/^(SELECT|PRAGMA)\b/i.test(trimmed)) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SQL_NOT_READ_ONLY:${trimmed.slice(0, 40)}`);
  }
  if (READ_ONLY_SQL_FORBIDDEN.test(trimmed)) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SQL_FORBIDDEN:${trimmed.match(READ_ONLY_SQL_FORBIDDEN)?.[1] ?? "forbidden"}`);
  }
  assertNoSensitiveTokens(trimmed);
}

function assertSafeDatabase(binding: CanaryBinding): void {
  if (hasProductiveToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PRODUCTIVE_DB:${binding.binding}:${binding.databaseName}`);
  }
  if (!hasCanaryOrNonprodToken(binding.databaseName)) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_NOT_CANARY_OR_NONPROD:${binding.binding}:${binding.databaseName}`);
  }
}

function parseJsonRows(output: string): unknown[] {
  const parsed = JSON.parse(output) as Array<{ results?: unknown[] }>;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }
  return parsed[0]?.results ?? [];
}

function defaultCheckDatabaseAccess(binding: CanaryBinding): SocialflowNonprodSmokeDbAccessReport {
  assertSafeDatabase(binding);
  assertSafeSocialflowNonprodSwitchesOffSmokeSql(DB_ACCESS_SQL);
  const displayCommand = `wrangler d1 execute ${binding.databaseName} --remote --command "${DB_ACCESS_SQL}" --json`;
  console.log("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_REMOTE_COMMAND_PRECHECK");
  console.log(JSON.stringify({
    command: displayCommand,
    databaseName: binding.databaseName,
    databaseContainsProd: hasProductiveToken(binding.databaseName),
    databasePosture: "canary/nonprod",
    writesData: false,
    isDeploy: false,
    activatesSwitches: false,
    oauthExcluded: true,
    tokensCredentialsExcluded: true,
    touches: `read-only accessibility check for ${binding.binding}`,
  }, null, 2));

  let output = "";
  try {
    output = execFileSync(
      "pnpm",
      [
        "wrangler",
        "d1",
        "execute",
        binding.databaseName,
        "--remote",
        "--command",
        DB_ACCESS_SQL,
        "--json",
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
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_DB_ACCESS_FAILED:${binding.binding}:${stderr.trim()}`);
  }

  const rows = parseJsonRows(output);
  return {
    binding: binding.binding,
    databaseName: binding.databaseName,
    databaseId: binding.databaseId,
    accessible: true,
    sql: DB_ACCESS_SQL,
    rowCount: rows.length,
  };
}

function getBinding(report: SocialflowNonprodCanaryConfigReport, bindingName: string): CanaryBinding {
  const binding = report.bindings.find((candidate) => candidate.binding === bindingName);
  if (!binding) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertConfigReportsSafe(reports: SocialflowNonprodCanaryConfigReport[]): void {
  for (const report of reports) {
    if (report.status !== "NON_DEPLOYABLE_REAL_NONPROD_CONFIG") {
      throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_UNSAFE_STATUS:${report.configPath}:${report.status}`);
    }
    if (report.deployable) {
      throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_DEPLOYABLE_BLOCKED:${report.configPath}`);
    }
    if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
      throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_ROLLBACK_NOT_OFF:${report.configPath}`);
    }
    for (const switchName of OFF_SWITCHES) {
      if (report.switches[switchName] !== "0") {
        throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SWITCH_NOT_OFF:${report.configPath}:${switchName}`);
      }
    }
  }
}

function assertBindingAlignment(reports: SocialflowNonprodCanaryConfigReport[]): Record<(typeof REQUIRED_BINDINGS)[number], CanaryBinding> {
  if (reports.length === 0) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_CONFIG_REPORTS_EMPTY");
  }

  const canonical = {} as Record<(typeof REQUIRED_BINDINGS)[number], CanaryBinding>;
  const first = reports[0];
  for (const bindingName of REQUIRED_BINDINGS) {
    canonical[bindingName] = getBinding(first, bindingName);
  }

  for (const report of reports.slice(1)) {
    for (const bindingName of REQUIRED_BINDINGS) {
      const candidate = getBinding(report, bindingName);
      const reference = canonical[bindingName];
      if (candidate.databaseName !== reference.databaseName || candidate.databaseId !== reference.databaseId) {
        throw new Error(
          `SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_BINDING_MISMATCH:${bindingName}:${reference.databaseName}:${candidate.databaseName}`,
        );
      }
    }
  }

  return canonical;
}

function assertSourceVerify(report: SocialflowNonprodSourceBootstrapReport, dracoDbName: string): void {
  if (report.status !== "VERIFY_OK") {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SOURCE_VERIFY_FAILED:${report.status}`);
  }
  if (report.targetDbName !== dracoDbName) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SOURCE_DB_MISMATCH:${report.targetDbName}:${dracoDbName}`);
  }
  if (report.remoteWrites !== 0) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SOURCE_REMOTE_WRITES:${report.remoteWrites}`);
  }
  if (!report.idempotent) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SOURCE_NOT_IDEMPOTENT");
  }
  if (!report.oauthExcluded) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SOURCE_OAUTH_SCOPE_BROKEN");
  }
  for (const [tableName, tableReport] of Object.entries(report.tables)) {
    if (!tableReport.tableExists || !tableReport.rowExists || tableReport.sourceRows < 1) {
      throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_SOURCE_TABLE_INCOMPLETE:${tableName}`);
    }
  }
}

function assertOwnershipVerify(
  report: SocialflowNonprodOwnershipBackfillReport,
  dracoDbName: string,
  socialDbName: string,
): void {
  if (report.status !== "VERIFY_OK") {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_OWNERSHIP_VERIFY_FAILED:${report.status}`);
  }
  if (report.sourceDbName !== dracoDbName || report.targetDbName !== socialDbName) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_OWNERSHIP_DB_MISMATCH:${report.sourceDbName}:${report.targetDbName}`);
  }
  if (report.remoteWrites !== 0) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_OWNERSHIP_REMOTE_WRITES:${report.remoteWrites}`);
  }
  if (!report.idempotent) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_OWNERSHIP_NOT_IDEMPOTENT");
  }
  if (!report.oauthExcluded) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_OWNERSHIP_OAUTH_SCOPE_BROKEN");
  }
  for (const [tableName, count] of Object.entries(report.targetCounts)) {
    if (count < 1) {
      throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_TARGET_COUNT_EMPTY:${tableName}`);
    }
  }
  for (const [groupName, tableReport] of Object.entries(report.tables)) {
    if (tableReport.sourceRows < 1 || tableReport.selected < 1 || tableReport.targetRows < 1) {
      throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_TARGET_GROUP_INCOMPLETE:${groupName}`);
    }
  }
}

function assertParity(report: SocialflowNonprodOwnershipParityReport, dracoDbName: string, socialDbName: string): void {
  if (report.status !== "PARITY_OK" || report.exitCode !== 0) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PARITY_FAILED:${report.status}:${report.exitCode}`);
  }
  if (report.sourceDbName !== dracoDbName || report.targetDbName !== socialDbName) {
    throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PARITY_DB_MISMATCH:${report.sourceDbName}:${report.targetDbName}`);
  }
  if (!report.readOnly || report.remoteWrites !== 0) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PARITY_NOT_READ_ONLY");
  }
  if (!report.oauthExcluded) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PARITY_OAUTH_SCOPE_BROKEN");
  }
  for (const token of REQUIRED_SKIPPED_OAUTH_TOKENS) {
    if (!report.skippedOAuth.includes(token)) {
      throw new Error(`SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PARITY_OAUTH_SKIP_MISSING:${token}`);
    }
  }
  if (report.totals.matched < 1) {
    throw new Error("SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PARITY_MATCHED_ZERO");
  }
  if (report.totals.missingInSocial !== 0 || report.totals.missingInCore !== 0 || report.totals.mismatched !== 0 || report.totals.emptySources !== 0) {
    throw new Error(
      `SOCIALFLOW_NONPROD_SWITCHES_OFF_SMOKE_PARITY_TOTALS_INVALID:${report.totals.missingInSocial}:${report.totals.missingInCore}:${report.totals.mismatched}:${report.totals.emptySources}`,
    );
  }
}

function parseArgs(argv: string[]): SmokeOptions & { json: boolean } {
  return {
    json: argv.includes("--json"),
    configPaths: argv.filter((arg) => arg.startsWith("--config=")).map((arg) => arg.slice("--config=".length)),
  };
}

export async function runSmokeSocialflowNonprodCanaryWithSwitchesOff(
  options: SmokeOptions = {},
  dependencies: SmokeDependencies = {},
): Promise<SocialflowNonprodCanarySwitchesOffSmokeReport> {
  const configPaths = options.configPaths?.length ? options.configPaths : [...DEFAULT_CONFIG_PATHS];
  const checkConfig = dependencies.checkConfig ?? checkSocialflowNonprodCanaryConfig;
  const checkDatabaseAccess = dependencies.checkDatabaseAccess ?? defaultCheckDatabaseAccess;
  const runSourceVerify = dependencies.runSourceVerify ?? ((runOptions) =>
    runBootstrapSocialflowNonprodSourceData({ ...runOptions, json: false }));
  const runOwnershipVerify = dependencies.runOwnershipVerify ?? ((runOptions) =>
    runBackfillSocialflowNonprodOwnershipReadModels(runOptions));
  const runParity = dependencies.runParity ?? ((runOptions) =>
    runCheckSocialflowNonprodOwnershipParity({ ...runOptions, json: false }));

  const configReports = configPaths.map((configPath) => checkConfig({ configPath }));
  assertConfigReportsSafe(configReports);
  const bindings = assertBindingAlignment(configReports);
  const databaseAccess = REQUIRED_BINDINGS.map((bindingName) => checkDatabaseAccess(bindings[bindingName]));

  const sourceVerify = await runSourceVerify({
    mode: "verify-only",
    configPaths,
  });
  assertSourceVerify(sourceVerify, bindings.DRACO_DB.databaseName);

  const ownershipVerify = await runOwnershipVerify({
    mode: "verify-only",
    configPaths,
  });
  assertOwnershipVerify(ownershipVerify, bindings.DRACO_DB.databaseName, bindings.SOCIAL_DB.databaseName);

  const parity = await runParity({ configPaths });
  assertParity(parity, bindings.DRACO_DB.databaseName, bindings.SOCIAL_DB.databaseName);

  const touchedDatabases = Array.from(new Set([
    ...databaseAccess.map((entry) => entry.databaseName),
    sourceVerify.targetDbName,
    ownershipVerify.sourceDbName,
    ownershipVerify.targetDbName,
    parity.sourceDbName,
    parity.targetDbName,
  ]));

  return {
    ok: true,
    status: "SMOKE_OK",
    configReports,
    databaseAccess,
    sourceVerify,
    ownershipVerify,
    parity,
    oauthExcluded: true,
    oauthTouchedDatabases: [],
    remoteWrites: 0,
    touchedDatabases,
    readyForNextPhase: true,
    nextPhaseRecommendation: NEXT_PHASE_RECOMMENDATION,
  };
}

export async function runSmokeSocialflowNonprodCanaryWithSwitchesOffCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  try {
    const report = await runSmokeSocialflowNonprodCanaryWithSwitchesOff(options);
    const summary = options.json ? { ok: report.ok, report } : {
      ok: report.ok,
      status: report.status,
      databaseAccess: report.databaseAccess,
      touchedDatabases: report.touchedDatabases,
      remoteWrites: report.remoteWrites,
      oauthExcluded: report.oauthExcluded,
      oauthTouchedDatabases: report.oauthTouchedDatabases,
      readyForNextPhase: report.readyForNextPhase,
      nextPhaseRecommendation: report.nextPhaseRecommendation,
      sourceVerify: {
        status: report.sourceVerify.status,
        targetDbName: report.sourceVerify.targetDbName,
        remoteWrites: report.sourceVerify.remoteWrites,
        idempotent: report.sourceVerify.idempotent,
      },
      ownershipVerify: {
        status: report.ownershipVerify.status,
        sourceDbName: report.ownershipVerify.sourceDbName,
        targetDbName: report.ownershipVerify.targetDbName,
        remoteWrites: report.ownershipVerify.remoteWrites,
        idempotent: report.ownershipVerify.idempotent,
        targetCounts: report.ownershipVerify.targetCounts,
      },
      parity: {
        status: report.parity.status,
        sourceDbName: report.parity.sourceDbName,
        targetDbName: report.parity.targetDbName,
        remoteWrites: report.parity.remoteWrites,
        totals: report.parity.totals,
      },
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log("SOCIALFLOW_NONPROD_CANARY_SWITCHES_OFF_SMOKE_SUCCESS");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_CANARY_SWITCHES_OFF_SMOKE_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  runSmokeSocialflowNonprodCanaryWithSwitchesOffCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
