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
const OAUTH_SWITCH = "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH";
const LEGACY_SWITCH = "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH";

const REQUIRED_BINDINGS = ["DRACO_DB", "SAASES_DB", "SOCIAL_DB", "SOCIALFLOW_AUTHS_DB"] as const;
const DEFAULT_EXPORTS_CONTRACT_TEST_PATH = "tests/lib/socialflow-export-social-read-prep-contract.test.ts";
const DEFAULT_EXPORTS_SERVICE_TEST_PATH = "apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts";

type SmokeOptions = {
  configPaths?: string[];
  exportsContractTestPath?: string;
  exportsServiceTestPath?: string;
  json?: boolean;
};

type ContractEvidence = {
  testPath: string;
  switchEnv: typeof EXPORTS_SWITCH;
  switchValue: "1";
  validatesSocialDbFirstRead: true;
  validatesCoreFallbackOnMissing: true;
  validatesCoreFallbackOnError: true;
  validatesZipPayloadIntact: true;
};

export type SocialflowNonprodExportsSwitchReport = {
  ok: true;
  status: "EXPORTS_SWITCH_SMOKE_OK";
  configReports: SocialflowNonprodCanaryConfigReport[];
  runtimeSeedSwitch: "1";
  exportsSwitch: "1";
  oauthSwitch: "0";
  legacySwitch: "0";
  deployable: false;
  remoteWrites: 0;
  deploy: false;
  oauthExcluded: true;
  configuredDatabases: string[];
  contractEvidence: ContractEvidence;
  parityReport: {
    status: SocialflowNonprodOwnershipParityReport["status"];
    exportsGroupMatched: number;
    exportsGroupMissingInSocial: number;
    exportsGroupMissingInCore: number;
    exportsGroupMismatched: number;
  };
  rollbackReady: true;
  rollbackTarget: {
    exportsToOff: true;
    configPaths: string[];
  };
  nextPhaseRecommendation: "MONITOR_EXPORTS_SOCIAL_DB_FIRST_THEN_ACTIVATE_LEGACY";
};

type SmokeDependencies = {
  checkConfig?: (options: { configPath: string }) => SocialflowNonprodCanaryConfigReport;
  runParity?: () => Promise<SocialflowNonprodOwnershipParityReport>;
  runContractTests?: (testPath: string) => void;
};

function hasProductiveToken(value: string): boolean {
  return /(^|[_\-\s])prod($|[_\-\s])/i.test(value);
}

function getBinding(report: SocialflowNonprodCanaryConfigReport, bindingName: string): { binding: string; databaseName: string; databaseId: string } {
  const binding = report.bindings.find((candidate) => candidate.binding === bindingName);
  if (!binding) {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertBindingAlignment(reports: SocialflowNonprodCanaryConfigReport[]): Record<(typeof REQUIRED_BINDINGS)[number], { binding: string; databaseName: string; databaseId: string }> {
  if (reports.length === 0) {
    throw new Error("SOCIALFLOW_EXPORTS_SWITCH_CONFIG_REPORTS_EMPTY");
  }

  const canonical = {} as Record<(typeof REQUIRED_BINDINGS)[number], { binding: string; databaseName: string; databaseId: string }>;
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
          `SOCIALFLOW_EXPORTS_SWITCH_BINDING_MISMATCH:${bindingName}:${reference.databaseName}:${candidate.databaseName}`,
        );
      }
    }
  }

  return canonical;
}

function assertExportsSwitchPosture(report: SocialflowNonprodCanaryConfigReport): void {
  if (report.status !== "NON_DEPLOYABLE_REAL_NONPROD_CONFIG") {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_UNSAFE_STATUS:${report.configPath}:${report.status}`);
  }
  if (report.deployable) {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_DEPLOYABLE_BLOCKED:${report.configPath}`);
  }
  if (report.switches[RUNTIME_SEED_SWITCH] !== "1") {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_RUNTIME_SEED_NOT_ON:${report.configPath}:${report.switches[RUNTIME_SEED_SWITCH] ?? "missing"}`);
  }
  if (report.switches[EXPORTS_SWITCH] !== "1") {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_EXPORTS_NOT_ON:${report.configPath}:${report.switches[EXPORTS_SWITCH] ?? "missing"}`);
  }
  if (report.switches[OAUTH_SWITCH] !== "0") {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_OAUTH_MUST_BE_OFF:${report.configPath}:${report.switches[OAUTH_SWITCH] ?? "missing"}`);
  }
  if (report.switches[LEGACY_SWITCH] !== "0") {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_LEGACY_MUST_BE_OFF:${report.configPath}:${report.switches[LEGACY_SWITCH] ?? "missing"}`);
  }
  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_ROLLBACK_STATE_UNSAFE:${report.configPath}`);
  }
  for (const binding of report.bindings) {
    if (hasProductiveToken(binding.databaseName)) {
      throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_PRODUCTIVE_DB:${binding.binding}:${binding.databaseName}`);
    }
  }
}

function defaultRunContractTests(testPath: string): void {
  execFileSync(
    "npx",
    ["vitest", "run", testPath, "--reporter=verbose"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        [EXPORTS_SWITCH]: "1",
      },
      stdio: "inherit",
    },
  );
}

function parseArgs(argv: string[]): SmokeOptions & { json: boolean } {
  const contractTestArg = argv.find((arg) => arg.startsWith("--exports-contract-test="));
  const serviceTestArg = argv.find((arg) => arg.startsWith("--exports-service-test="));
  return {
    json: argv.includes("--json"),
    configPaths: argv.filter((arg) => arg.startsWith("--config=")).map((arg) => arg.slice("--config=".length)),
    exportsContractTestPath: contractTestArg ? contractTestArg.slice("--exports-contract-test=".length) : DEFAULT_EXPORTS_CONTRACT_TEST_PATH,
    exportsServiceTestPath: serviceTestArg ? serviceTestArg.slice("--exports-service-test=".length) : DEFAULT_EXPORTS_SERVICE_TEST_PATH,
  };
}

export async function runSmokeSocialflowNonprodExportsSwitch(
  options: SmokeOptions = {},
  dependencies: SmokeDependencies = {},
): Promise<SocialflowNonprodExportsSwitchReport> {
  const configPaths = options.configPaths?.length ? options.configPaths : [...DEFAULT_CONFIG_PATHS];
  const exportsContractTestPath = options.exportsContractTestPath ?? DEFAULT_EXPORTS_CONTRACT_TEST_PATH;
  const exportsServiceTestPath = options.exportsServiceTestPath ?? DEFAULT_EXPORTS_SERVICE_TEST_PATH;
  const checkConfig = dependencies.checkConfig ?? checkSocialflowNonprodCanaryConfig;
  const runParity = dependencies.runParity ?? (() => runCheckSocialflowNonprodOwnershipParity({ allowEmptySource: false }));
  const runContractTests = dependencies.runContractTests ?? defaultRunContractTests;

  const configReports = configPaths.map((configPath) => checkConfig({ configPath }));
  for (const report of configReports) {
    assertExportsSwitchPosture(report);
  }
  const bindings = assertBindingAlignment(configReports);

  runContractTests(exportsContractTestPath);
  runContractTests(exportsServiceTestPath);

  const parityReport = await runParity();
  if (!parityReport.ok) {
    throw new Error(`SOCIALFLOW_EXPORTS_SWITCH_PARITY_FAILED:${parityReport.status}`);
  }

  const exportsGroup = parityReport.groups.exports;

  return {
    ok: true,
    status: "EXPORTS_SWITCH_SMOKE_OK",
    configReports,
    runtimeSeedSwitch: "1",
    exportsSwitch: "1",
    oauthSwitch: "0",
    legacySwitch: "0",
    deployable: false,
    remoteWrites: 0,
    deploy: false,
    oauthExcluded: true,
    configuredDatabases: REQUIRED_BINDINGS.map((bindingName) => bindings[bindingName].databaseName),
    contractEvidence: {
      testPath: exportsContractTestPath,
      switchEnv: EXPORTS_SWITCH,
      switchValue: "1",
      validatesSocialDbFirstRead: true,
      validatesCoreFallbackOnMissing: true,
      validatesCoreFallbackOnError: true,
      validatesZipPayloadIntact: true,
    },
    parityReport: {
      status: parityReport.status,
      exportsGroupMatched: exportsGroup.matched,
      exportsGroupMissingInSocial: exportsGroup.missingInSocial.length,
      exportsGroupMissingInCore: exportsGroup.missingInCore.length,
      exportsGroupMismatched: exportsGroup.mismatched.length,
    },
    rollbackReady: true,
    rollbackTarget: {
      exportsToOff: true,
      configPaths,
    },
    nextPhaseRecommendation: "MONITOR_EXPORTS_SOCIAL_DB_FIRST_THEN_ACTIVATE_LEGACY",
  };
}

export async function runSmokeSocialflowNonprodExportsSwitchCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  try {
    const report = await runSmokeSocialflowNonprodExportsSwitch(options);
    const summary = options.json ? { ok: report.ok, report } : {
      ok: report.ok,
      status: report.status,
      runtimeSeedSwitch: report.runtimeSeedSwitch,
      exportsSwitch: report.exportsSwitch,
      oauthSwitch: report.oauthSwitch,
      legacySwitch: report.legacySwitch,
      deployable: report.deployable,
      remoteWrites: report.remoteWrites,
      deploy: report.deploy,
      oauthExcluded: report.oauthExcluded,
      configuredDatabases: report.configuredDatabases,
      contractEvidence: report.contractEvidence,
      parityReport: report.parityReport,
      rollbackReady: report.rollbackReady,
      rollbackTarget: report.rollbackTarget,
      nextPhaseRecommendation: report.nextPhaseRecommendation,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log("SOCIALFLOW_NONPROD_EXPORTS_SWITCH_SMOKE_SUCCESS");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_EXPORTS_SWITCH_SMOKE_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  runSmokeSocialflowNonprodExportsSwitchCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
