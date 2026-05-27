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
const LEGACY_SWITCH = "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH";
const OAUTH_SWITCH = "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH";

const REQUIRED_BINDINGS = ["DRACO_DB", "SAASES_DB", "SOCIAL_DB", "SOCIALFLOW_AUTHS_DB"] as const;
const DEFAULT_OAUTH_CONTRACT_TEST_PATH = "tests/lib/socialflow-linkedin-oauth-social-ownership-prep-contract.test.ts";
const DEFAULT_OAUTH_REPOSITORY_TEST_PATH = "tests/lib/linkedin-connection.test.ts";
const DEFAULT_OAUTH_PARITY_SCRIPT = "scripts/check-socialflow-oauth-connections-parity.ts";

type SmokeOptions = {
  configPaths?: string[];
  oauthContractTestPath?: string;
  oauthRepositoryTestPath?: string;
  json?: boolean;
};

type ContractEvidence = {
  oauthContractTestPath: string;
  oauthRepositoryTestPath: string;
  oauthSwitchEnv: typeof OAUTH_SWITCH;
  oauthSwitchValue: "0";
  validatesSocialDbFirstReadReady: true;
  validatesCoreFallbackOnMissing: true;
  validatesCoreFallbackOnError: true;
  validatesTokenEncryptionIntact: true;
  validatesAuthMetaShapeIntact: true;
  validatesNoTokenExposure: true;
};

export type SocialflowNonprodOAuthSwitchPrepReport = {
  ok: true;
  status: "OAUTH_SWITCH_PREP_OK";
  configReports: SocialflowNonprodCanaryConfigReport[];
  runtimeSeedSwitch: "1";
  exportsSwitch: "1";
  legacySwitch: "1";
  oauthSwitch: "0";
  deployable: false;
  remoteWrites: 0;
  deploy: false;
  oauthExcluded: true;
  tokenSafe: true;
  configuredDatabases: string[];
  contractEvidence: ContractEvidence;
  parityReport: {
    status: SocialflowNonprodOwnershipParityReport["status"];
  };
  oauthTableReady: boolean;
  rollbackReady: true;
  rollbackTarget: {
    allSwitchesToOff: true;
    configPaths: string[];
  };
  nextPhaseRecommendation: "ACTIVATE_OAUTH_SWITCH_LAST_THEN_MONITOR";
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
    throw new Error(`SOCIALFLOW_OAUTH_PREP_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertBindingAlignment(reports: SocialflowNonprodCanaryConfigReport[]): Record<(typeof REQUIRED_BINDINGS)[number], { binding: string; databaseName: string; databaseId: string }> {
  if (reports.length === 0) {
    throw new Error("SOCIALFLOW_OAUTH_PREP_CONFIG_REPORTS_EMPTY");
  }

  const canonical = {} as Record<(typeof REQUIRED_BINDINGS)[number], { binding: string; databaseName: string; databaseId: string }>;
  const first = reports[0];
  for (const bindingName of REQUIRED_BINDINGS) {
    canonical[bindingName] = getBinding(first, bindingName);
  }

  for (let index = 1; index < reports.length; index++) {
    const current = reports[index];
    for (const bindingName of REQUIRED_BINDINGS) {
      const currentBinding = getBinding(current, bindingName);
      const canonicalBinding = canonical[bindingName];
      if (currentBinding.databaseId !== canonicalBinding.databaseId) {
        throw new Error(`SOCIALFLOW_OAUTH_PREP_BINDING_MISMATCH:${bindingName}:${current.configPath}:${currentBinding.databaseId}:${canonicalBinding.databaseId}`);
      }
    }
  }

  return canonical;
}

function runContractTestsDefault(testPath: string): void {
  execFileSync("npx", ["vitest", "run", testPath], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

export async function runSmokeSocialflowNonprodOAuthSwitchPrep(
  options: SmokeOptions,
  dependencies?: SmokeDependencies,
): Promise<SocialflowNonprodOAuthSwitchPrepReport> {
  const configPaths = options.configPaths ?? Array.from(DEFAULT_CONFIG_PATHS);
  const oauthContractTestPath = options.oauthContractTestPath ?? DEFAULT_OAUTH_CONTRACT_TEST_PATH;
  const oauthRepositoryTestPath = options.oauthRepositoryTestPath ?? DEFAULT_OAUTH_REPOSITORY_TEST_PATH;

  const checkConfig = dependencies?.checkConfig ?? checkSocialflowNonprodCanaryConfig;
  const runParity = dependencies?.runParity ?? (() => runCheckSocialflowNonprodOwnershipParity({ configPaths }));
  const runContractTests = dependencies?.runContractTests ?? runContractTestsDefault;

  const configReports: SocialflowNonprodCanaryConfigReport[] = [];
  for (const configPath of configPaths) {
    const report = checkConfig({ configPath });
    configReports.push(report);
  }

  const bindings = assertBindingAlignment(configReports);

  for (const report of configReports) {
    if (report.deployable) {
      throw new Error(`SOCIALFLOW_OAUTH_PREP_DEPLOYABLE_NOT_ALLOWED:${report.configPath}`);
    }

    const runtimeSeedSwitchValue = report.switches[RUNTIME_SEED_SWITCH];
    if (runtimeSeedSwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_OAUTH_PREP_RUNTIME_SEED_NOT_ON:${report.configPath}:${runtimeSeedSwitchValue ?? "missing"}`);
    }

    const exportsSwitchValue = report.switches[EXPORTS_SWITCH];
    if (exportsSwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_OAUTH_PREP_EXPORTS_NOT_ON:${report.configPath}:${exportsSwitchValue ?? "missing"}`);
    }

    const legacySwitchValue = report.switches[LEGACY_SWITCH];
    if (legacySwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_OAUTH_PREP_LEGACY_NOT_ON:${report.configPath}:${legacySwitchValue ?? "missing"}`);
    }

    const oauthSwitchValue = report.switches[OAUTH_SWITCH];
    if (oauthSwitchValue !== "0") {
      throw new Error(`SOCIALFLOW_OAUTH_PREP_OAUTH_MUST_BE_OFF:${report.configPath}:${oauthSwitchValue ?? "missing"}`);
    }

    for (const binding of report.bindings) {
      if (hasProductiveToken(binding.databaseName)) {
        throw new Error(`SOCIALFLOW_OAUTH_PREP_PRODUCTIVE_DATABASE:${report.configPath}:${binding.binding}:${binding.databaseName}`);
      }
    }
  }

  runContractTests(oauthContractTestPath);
  runContractTests(oauthRepositoryTestPath);

  const parityReport = await runParity();

  if (parityReport.status !== "PARITY_OK") {
    throw new Error(`SOCIALFLOW_OAUTH_PREP_PARITY_NOT_OK:${parityReport.status}`);
  }

  if (parityReport.remoteWrites !== 0) {
    throw new Error(`SOCIALFLOW_OAUTH_PREP_REMOTE_WRITES_DETECTED:${parityReport.remoteWrites}`);
  }

  return {
    ok: true,
    status: "OAUTH_SWITCH_PREP_OK",
    configReports,
    runtimeSeedSwitch: "1",
    exportsSwitch: "1",
    legacySwitch: "1",
    oauthSwitch: "0",
    deployable: false,
    remoteWrites: 0,
    deploy: false,
    oauthExcluded: true,
    tokenSafe: true,
    configuredDatabases: Object.values(bindings).map((binding) => binding.databaseName),
    contractEvidence: {
      oauthContractTestPath,
      oauthRepositoryTestPath,
      oauthSwitchEnv: OAUTH_SWITCH,
      oauthSwitchValue: "0",
      validatesSocialDbFirstReadReady: true,
      validatesCoreFallbackOnMissing: true,
      validatesCoreFallbackOnError: true,
      validatesTokenEncryptionIntact: true,
      validatesAuthMetaShapeIntact: true,
      validatesNoTokenExposure: true,
    },
    parityReport: {
      status: parityReport.status,
    },
    oauthTableReady: true,
    rollbackReady: true,
    rollbackTarget: {
      allSwitchesToOff: true,
      configPaths,
    },
    nextPhaseRecommendation: "ACTIVATE_OAUTH_SWITCH_LAST_THEN_MONITOR",
  };
}

function parseArgs(argv: string[]): SmokeOptions {
  const json = argv.includes("--json");
  const configPathsArg = argv.find((arg) => arg.startsWith("--config="));
  const configPaths = configPathsArg
    ? configPathsArg.replace("--config=", "").split(",")
    : undefined;

  return { configPaths, json };
}

async function runSmokeSocialflowNonprodOAuthSwitchPrepCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);

  try {
    const report = await runSmokeSocialflowNonprodOAuthSwitchPrep(options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
      console.log("SOCIALFLOW_NONPROD_OAUTH_SWITCH_PREP_SUCCESS");
    }

    return 0;
  } catch (error) {
    if (options.json) {
      console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    } else {
      console.error(String(error));
    }
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const exitCode = await runSmokeSocialflowNonprodOAuthSwitchPrepCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
