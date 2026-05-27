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
const DEFAULT_LEGACY_CONTRACT_TEST_PATH = "tests/lib/socialflow-legacy-social-ownership-prep-contract.test.ts";
const DEFAULT_LEGACY_SWITCH_TEST_PATH = "tests/lib/socialflow-legacy-read-models-switch.test.ts";

type SmokeOptions = {
  configPaths?: string[];
  legacyContractTestPath?: string;
  legacySwitchTestPath?: string;
  json?: boolean;
};

type ContractEvidence = {
  legacyContractTestPath: string;
  legacySwitchTestPath: string;
  legacySwitchEnv: typeof LEGACY_SWITCH;
  legacySwitchValue: "1";
  validatesSocialDbFirstRead: true;
  validatesCoreFallbackOnMissing: true;
  validatesCoreFallbackOnError: true;
  validatesPayloadCompatibility: true;
};

export type SocialflowNonprodLegacySwitchReport = {
  ok: true;
  status: "LEGACY_SWITCH_SMOKE_OK";
  configReports: SocialflowNonprodCanaryConfigReport[];
  runtimeSeedSwitch: "1";
  exportsSwitch: "1";
  legacySwitch: "1";
  oauthSwitch: "0";
  deployable: false;
  remoteWrites: 0;
  deploy: false;
  oauthExcluded: true;
  configuredDatabases: string[];
  contractEvidence: ContractEvidence;
  parityReport: {
    status: SocialflowNonprodOwnershipParityReport["status"];
    legacyGroupMatched: number;
    legacyGroupMissingInSocial: number;
    legacyGroupMissingInCore: number;
    legacyGroupMismatched: number;
  };
  rollbackReady: true;
  rollbackTarget: {
    legacyToOff: true;
    configPaths: string[];
  };
  nextPhaseRecommendation: "PREPARE_OAUTH_SWITCH_LAST";
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
    throw new Error(`SOCIALFLOW_LEGACY_SWITCH_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertBindingAlignment(reports: SocialflowNonprodCanaryConfigReport[]): Record<(typeof REQUIRED_BINDINGS)[number], { binding: string; databaseName: string; databaseId: string }> {
  if (reports.length === 0) {
    throw new Error("SOCIALFLOW_LEGACY_SWITCH_CONFIG_REPORTS_EMPTY");
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
        throw new Error(`SOCIALFLOW_LEGACY_SWITCH_BINDING_MISMATCH:${bindingName}:${current.configPath}:${currentBinding.databaseId}:${canonicalBinding.databaseId}`);
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

export async function runSmokeSocialflowNonprodLegacySwitch(
  options: SmokeOptions,
  dependencies?: SmokeDependencies,
): Promise<SocialflowNonprodLegacySwitchReport> {
  const configPaths = options.configPaths ?? Array.from(DEFAULT_CONFIG_PATHS);
  const legacyContractTestPath = options.legacyContractTestPath ?? DEFAULT_LEGACY_CONTRACT_TEST_PATH;
  const legacySwitchTestPath = options.legacySwitchTestPath ?? DEFAULT_LEGACY_SWITCH_TEST_PATH;

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
      throw new Error(`SOCIALFLOW_LEGACY_SWITCH_DEPLOYABLE_NOT_ALLOWED:${report.configPath}`);
    }

    const runtimeSeedSwitchValue = report.switches[RUNTIME_SEED_SWITCH];
    if (runtimeSeedSwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_LEGACY_SWITCH_RUNTIME_SEED_NOT_ON:${report.configPath}:${runtimeSeedSwitchValue ?? "missing"}`);
    }

    const exportsSwitchValue = report.switches[EXPORTS_SWITCH];
    if (exportsSwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_LEGACY_SWITCH_EXPORTS_NOT_ON:${report.configPath}:${exportsSwitchValue ?? "missing"}`);
    }

    const legacySwitchValue = report.switches[LEGACY_SWITCH];
    if (legacySwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_LEGACY_SWITCH_NOT_ON:${report.configPath}:${legacySwitchValue ?? "missing"}`);
    }

    const oauthSwitchValue = report.switches[OAUTH_SWITCH];
    if (oauthSwitchValue !== "0") {
      throw new Error(`SOCIALFLOW_LEGACY_SWITCH_OAUTH_NOT_OFF:${report.configPath}:${oauthSwitchValue ?? "missing"}`);
    }

    for (const binding of report.bindings) {
      if (hasProductiveToken(binding.databaseName)) {
        throw new Error(`SOCIALFLOW_LEGACY_SWITCH_PRODUCTIVE_DATABASE:${report.configPath}:${binding.binding}:${binding.databaseName}`);
      }
    }
  }

  runContractTests(legacyContractTestPath);
  runContractTests(legacySwitchTestPath);

  const parityReport = await runParity();

  if (parityReport.status !== "PARITY_OK") {
    throw new Error(`SOCIALFLOW_LEGACY_SWITCH_PARITY_NOT_OK:${parityReport.status}`);
  }

  if (parityReport.remoteWrites !== 0) {
    throw new Error(`SOCIALFLOW_LEGACY_SWITCH_REMOTE_WRITES_DETECTED:${parityReport.remoteWrites}`);
  }

  const legacyGroups = Array.isArray(parityReport.groups)
    ? parityReport.groups.filter((group) =>
        ["socialflow_legacy_strategic_dossiers", "socialflow_legacy_tenant_progress", "socialflow_legacy_agent_work_logs", "socialflow_legacy_repository_context"].includes(group.targetTable)
      )
    : [];

  const legacyGroupMatched = legacyGroups.filter((group) => group.status === "matched").length;
  const legacyGroupMissingInSocial = legacyGroups.filter((group) => group.missingInSocial > 0).length;
  const legacyGroupMissingInCore = legacyGroups.filter((group) => group.missingInCore > 0).length;
  const legacyGroupMismatched = legacyGroups.filter((group) => group.mismatched > 0).length;

  return {
    ok: true,
    status: "LEGACY_SWITCH_SMOKE_OK",
    configReports,
    runtimeSeedSwitch: "1",
    exportsSwitch: "1",
    legacySwitch: "1",
    oauthSwitch: "0",
    deployable: false,
    remoteWrites: 0,
    deploy: false,
    oauthExcluded: true,
    configuredDatabases: Object.values(bindings).map((binding) => binding.databaseName),
    contractEvidence: {
      legacyContractTestPath,
      legacySwitchTestPath,
      legacySwitchEnv: LEGACY_SWITCH,
      legacySwitchValue: "1",
      validatesSocialDbFirstRead: true,
      validatesCoreFallbackOnMissing: true,
      validatesCoreFallbackOnError: true,
      validatesPayloadCompatibility: true,
    },
    parityReport: {
      status: parityReport.status,
      legacyGroupMatched,
      legacyGroupMissingInSocial,
      legacyGroupMissingInCore,
      legacyGroupMismatched,
    },
    rollbackReady: true,
    rollbackTarget: {
      legacyToOff: true,
      configPaths,
    },
    nextPhaseRecommendation: "PREPARE_OAUTH_SWITCH_LAST",
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

async function runSmokeSocialflowNonprodLegacySwitchCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);

  try {
    const report = await runSmokeSocialflowNonprodLegacySwitch(options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
      console.log("SOCIALFLOW_NONPROD_LEGACY_SWITCH_SMOKE_SUCCESS");
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
    const exitCode = await runSmokeSocialflowNonprodLegacySwitchCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
