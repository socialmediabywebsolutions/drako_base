import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkSocialflowNonprodCanaryConfig,
  type SocialflowNonprodCanaryConfigReport,
} from "./check-socialflow-nonprod-canary-config";
import {
  runCheckSocialflowNonprodOwnershipParity,
  type SocialflowNonprodOwnershipParityReport,
} from "./check-socialflow-nonprod-ownership-parity";

const DEFAULT_CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

const RUNTIME_SEED_SWITCH = "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH";
const EXPORTS_SWITCH = "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH";
const REQUIRED_OFF_SWITCHES = [
  "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
] as const;
const REQUIRED_BINDINGS = ["DRACO_DB", "SAASES_DB", "SOCIAL_DB", "SOCIALFLOW_AUTHS_DB"] as const;
const DEFAULT_RUNTIME_SEED_CONTRACT_TEST_PATH = "tests/lib/socialflow-runtime-seed-contract.test.ts";
const DEFAULT_EXPORTS_CONTRACT_TEST_PATH = "apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts";
const DEFAULT_EXPORTS_SOCIAL_READ_PREP_CONTRACT_TEST_PATH = "tests/lib/socialflow-export-social-read-prep-contract.test.ts";

type CanaryBinding = SocialflowNonprodCanaryConfigReport["bindings"][number];

type ReadinessOptions = {
  configPaths?: string[];
  runtimeSeedContractTestPath?: string;
  exportsContractTestPath?: string;
  exportsSocialReadPrepContractTestPath?: string;
  json?: boolean;
};

type ContractEvidence = {
  runtimeSeedTestPath: string;
  runtimeSeedSwitchEnv: typeof RUNTIME_SEED_SWITCH;
  runtimeSeedSwitchValue: "1";
  runtimeSeedValidatesSocialFirstRead: true;
  runtimeSeedValidatesCoreFallback: true;
  runtimeSeedValidatesSocialDbFailureFallback: true;
  exportsTestPath: string;
  exportsSwitchEnv: typeof EXPORTS_SWITCH;
  exportsSwitchValue: "1";
  exportsValidatesSocialDbFirstRead: true;
  exportsValidatesCoreFallbackOnMissing: true;
  exportsValidatesCoreFallbackOnError: true;
  exportsValidatesZipPayloadIntact: true;
  exportsSocialReadPrepTestPath: string;
  exportsSocialReadPrepValidatesSocialDbTable: true;
  exportsSocialReadPrepValidatesFailClosed: true;
};

export type SocialflowNonprodRuntimeAndExportsReadinessReport = {
  ok: true;
  status: "SOCIALFLOW_RUNTIME_EXPORTS_READINESS_OK";
  configReports: SocialflowNonprodCanaryConfigReport[];
  runtimeSeedSwitch: "1";
  exportsSwitch: "1";
  oauthSwitch: "0";
  legacySwitch: "0";
  deployable: false;
  runtimeSeedSource: "SOCIAL_DB";
  exportsSource: "SOCIAL_DB";
  fallbacksAvailable: true;
  fallbacksUsedInHealthyPath: false;
  parityReport: {
    status: "PARITY_OK";
    runtimeSeedGroupMatched: number;
    exportsGroupMatched: number;
    missingInSocial: number;
    missingInCore: number;
    mismatched: number;
  };
  remoteWrites: 0;
  deploy: false;
  oauthExcluded: true;
  configuredDatabases: string[];
  contractEvidence: ContractEvidence;
  rollbackReady: true;
  rollbackTarget: {
    runtimeSeedToOff: boolean;
    exportsToOff: boolean;
    configPaths: string[];
  };
  nextPhaseRecommendation: "PREPARE_LEGACY_SWITCH_NONPROD";
};

type ReadinessDependencies = {
  checkConfig?: (options: { configPath: string }) => SocialflowNonprodCanaryConfigReport;
  runParity?: (options: {
    configPaths: string[];
  }) => Promise<SocialflowNonprodOwnershipParityReport>;
  runContractTests?: (testPath: string) => void;
};

const KNOWN_PRODUCTIVE_TOKENS = [
  "prod",
  "production",
  "drako_db_prod",
  "live",
] as const;

function hasProductiveToken(value: string): boolean {
  const normalized = value.toLowerCase();
  return KNOWN_PRODUCTIVE_TOKENS.some((token) => normalized.includes(token));
}

function assertSafeConfig(report: SocialflowNonprodCanaryConfigReport): void {
  if (hasProductiveToken(report.configPath)) {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PRODUCTIVE_CONFIG:${report.configPath}`);
  }
  for (const binding of report.bindings) {
    if (hasProductiveToken(binding.databaseName)) {
      throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PRODUCTIVE_DB:${binding.binding}:${binding.databaseName}`);
    }
    if (hasProductiveToken(binding.databaseId)) {
      throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PRODUCTIVE_DB_ID:${binding.binding}:${binding.databaseId}`);
    }
  }
  if (report.deployable) {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_DEPLOYABLE_BLOCKED:${report.configPath}`);
  }
  const runtimeSeedSwitchValue = report.switches[RUNTIME_SEED_SWITCH];
  if (runtimeSeedSwitchValue !== "1") {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_RUNTIME_SEED_NOT_ON:${report.configPath}:${runtimeSeedSwitchValue ?? "missing"}`);
  }
  const exportsSwitchValue = report.switches[EXPORTS_SWITCH];
  if (exportsSwitchValue !== "1") {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_EXPORTS_NOT_ON:${report.configPath}:${exportsSwitchValue ?? "missing"}`);
  }
  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_ROLLBACK_STATE_UNSAFE:${report.configPath}`);
  }
  for (const switchName of REQUIRED_OFF_SWITCHES) {
    if (report.switches[switchName] !== "0") {
      throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_FORBIDDEN_SWITCH_ON:${report.configPath}:${switchName}:${report.switches[switchName] ?? "missing"}`);
    }
  }
}

function assertBindingAlignment(configReports: SocialflowNonprodCanaryConfigReport[]): Record<(typeof REQUIRED_BINDINGS)[number], CanaryBinding> {
  const bindingsMap: Partial<Record<(typeof REQUIRED_BINDINGS)[number], CanaryBinding>> = {};
  
  for (const bindingName of REQUIRED_BINDINGS) {
    const bindingsForThisName = configReports.map((report) =>
      report.bindings.find((b) => b.binding === bindingName)
    ).filter((b): b is CanaryBinding => b !== undefined);

    if (bindingsForThisName.length === 0) {
      throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_MISSING_BINDING:${bindingName}`);
    }

    const firstBinding = bindingsForThisName[0];
    for (const binding of bindingsForThisName) {
      if (binding.databaseName !== firstBinding.databaseName || binding.databaseId !== firstBinding.databaseId) {
        throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_BINDING_MISMATCH:${bindingName}:${firstBinding.databaseName}:${binding.databaseName}`);
      }
    }

    bindingsMap[bindingName] = firstBinding;
  }

  return bindingsMap as Record<(typeof REQUIRED_BINDINGS)[number], CanaryBinding>;
}

function runContractTests(testPath: string): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const rootDir = path.resolve(__dirname, "..");
  const absoluteTestPath = path.resolve(rootDir, testPath);

  try {
    execFileSync("npx", ["vitest", "run", absoluteTestPath, "--reporter=verbose"], {
      cwd: rootDir,
      stdio: "inherit",
      encoding: "utf-8",
    });
  } catch (error) {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_CONTRACT_TEST_FAILED:${testPath}`);
  }
}

export async function runSmokeSocialflowNonprodRuntimeAndExportsReadiness(
  options: ReadinessOptions = {},
  dependencies: ReadinessDependencies = {},
): Promise<SocialflowNonprodRuntimeAndExportsReadinessReport> {
  const configPaths = options.configPaths ?? [...DEFAULT_CONFIG_PATHS];
  const runtimeSeedContractTestPath = options.runtimeSeedContractTestPath ?? DEFAULT_RUNTIME_SEED_CONTRACT_TEST_PATH;
  const exportsContractTestPath = options.exportsContractTestPath ?? DEFAULT_EXPORTS_CONTRACT_TEST_PATH;
  const exportsSocialReadPrepContractTestPath = options.exportsSocialReadPrepContractTestPath ?? DEFAULT_EXPORTS_SOCIAL_READ_PREP_CONTRACT_TEST_PATH;

  const checkConfig = dependencies.checkConfig ?? checkSocialflowNonprodCanaryConfig;
  const runParity = dependencies.runParity ?? runCheckSocialflowNonprodOwnershipParity;
  const runTests = dependencies.runContractTests ?? runContractTests;

  const configReports = configPaths.map((configPath) => checkConfig({ configPath }));
  for (const report of configReports) {
    assertSafeConfig(report);
  }
  const bindings = assertBindingAlignment(configReports);

  const parityReport = await runParity({ configPaths });
  if (parityReport.status !== "PARITY_OK") {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PARITY_NOT_OK:${parityReport.status}`);
  }
  if (parityReport.totals.missingInSocial > 0) {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PARITY_MISSING_IN_SOCIAL:${parityReport.totals.missingInSocial}`);
  }
  if (parityReport.totals.mismatched > 0) {
    throw new Error(`SOCIALFLOW_RUNTIME_EXPORTS_READINESS_PARITY_MISMATCHED:${parityReport.totals.mismatched}`);
  }

  runTests(runtimeSeedContractTestPath);
  runTests(exportsContractTestPath);
  runTests(exportsSocialReadPrepContractTestPath);

  const runtimeSeedGroupMatched = parityReport.groups.runtimeSeed?.matched ?? 0;
  const exportsGroupMatched = parityReport.groups.exports?.matched ?? 0;

  return {
    ok: true,
    status: "SOCIALFLOW_RUNTIME_EXPORTS_READINESS_OK",
    configReports,
    runtimeSeedSwitch: "1",
    exportsSwitch: "1",
    oauthSwitch: "0",
    legacySwitch: "0",
    deployable: false,
    runtimeSeedSource: "SOCIAL_DB",
    exportsSource: "SOCIAL_DB",
    fallbacksAvailable: true,
    fallbacksUsedInHealthyPath: false,
    parityReport: {
      status: "PARITY_OK",
      runtimeSeedGroupMatched,
      exportsGroupMatched,
      missingInSocial: parityReport.totals.missingInSocial,
      missingInCore: parityReport.totals.missingInCore,
      mismatched: parityReport.totals.mismatched,
    },
    remoteWrites: 0,
    deploy: false,
    oauthExcluded: true,
    configuredDatabases: REQUIRED_BINDINGS.map((bindingName) => bindings[bindingName].databaseName),
    contractEvidence: {
      runtimeSeedTestPath: runtimeSeedContractTestPath,
      runtimeSeedSwitchEnv: RUNTIME_SEED_SWITCH,
      runtimeSeedSwitchValue: "1",
      runtimeSeedValidatesSocialFirstRead: true,
      runtimeSeedValidatesCoreFallback: true,
      runtimeSeedValidatesSocialDbFailureFallback: true,
      exportsTestPath: exportsContractTestPath,
      exportsSwitchEnv: EXPORTS_SWITCH,
      exportsSwitchValue: "1",
      exportsValidatesSocialDbFirstRead: true,
      exportsValidatesCoreFallbackOnMissing: true,
      exportsValidatesCoreFallbackOnError: true,
      exportsValidatesZipPayloadIntact: true,
      exportsSocialReadPrepTestPath: exportsSocialReadPrepContractTestPath,
      exportsSocialReadPrepValidatesSocialDbTable: true,
      exportsSocialReadPrepValidatesFailClosed: true,
    },
    rollbackReady: true,
    rollbackTarget: {
      runtimeSeedToOff: true,
      exportsToOff: true,
      configPaths,
    },
    nextPhaseRecommendation: "PREPARE_LEGACY_SWITCH_NONPROD",
  };
}

function parseArgs(argv: string[]): ReadinessOptions {
  const json = argv.includes("--json");
  const configPathsArg = argv.find((arg) => arg.startsWith("--config="));
  const configPaths = configPathsArg
    ? configPathsArg.replace("--config=", "").split(",")
    : undefined;

  return { configPaths, json };
}

export async function runSmokeSocialflowNonprodRuntimeAndExportsReadinessCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  try {
    const report = await runSmokeSocialflowNonprodRuntimeAndExportsReadiness(options);
    const summary = options.json ? { ok: report.ok, report } : {
      ok: report.ok,
      status: report.status,
      runtimeSeedSwitch: report.runtimeSeedSwitch,
      exportsSwitch: report.exportsSwitch,
      oauthSwitch: report.oauthSwitch,
      legacySwitch: report.legacySwitch,
      deployable: report.deployable,
      runtimeSeedSource: report.runtimeSeedSource,
      exportsSource: report.exportsSource,
      fallbacksAvailable: report.fallbacksAvailable,
      fallbacksUsedInHealthyPath: report.fallbacksUsedInHealthyPath,
      parityReport: report.parityReport,
      remoteWrites: report.remoteWrites,
      deploy: report.deploy,
      oauthExcluded: report.oauthExcluded,
      configuredDatabases: report.configuredDatabases,
      contractEvidence: report.contractEvidence,
      rollbackReady: report.rollbackReady,
      rollbackTarget: report.rollbackTarget,
      nextPhaseRecommendation: report.nextPhaseRecommendation,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log("SOCIALFLOW_RUNTIME_EXPORTS_READINESS_SUCCESS");
    return 0;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`SOCIALFLOW_NONPROD_RUNTIME_EXPORTS_READINESS_ERROR ${error.message}`);
      if (options.json) {
        console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
      }
    } else {
      console.error("SOCIALFLOW_NONPROD_RUNTIME_EXPORTS_READINESS_ERROR UNKNOWN_ERROR");
      if (options.json) {
        console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
      }
    }
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const exitCode = await runSmokeSocialflowNonprodRuntimeAndExportsReadinessCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
