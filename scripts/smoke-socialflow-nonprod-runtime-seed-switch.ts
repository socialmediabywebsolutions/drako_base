import { execFileSync } from "node:child_process";
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

const RUNTIME_SEED_SWITCH = "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH";
const FORBIDDEN_ON_SWITCHES = [
  "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
] as const;
const REQUIRED_BINDINGS = ["DRACO_DB", "SAASES_DB", "SOCIAL_DB", "SOCIALFLOW_AUTHS_DB"] as const;
const DEFAULT_CONTRACT_TEST_PATH = "tests/lib/socialflow-runtime-seed-contract.test.ts";

type CanaryBinding = SocialflowNonprodCanaryConfigReport["bindings"][number];

type SmokeOptions = {
  configPaths?: string[];
  contractTestPath?: string;
};

type ContractEvidence = {
  testPath: string;
  switchEnv: typeof RUNTIME_SEED_SWITCH;
  switchValue: "1";
  validatesSocialFirstRead: true;
  validatesCoreFallback: true;
  validatesSocialDbFailureFallback: true;
};

export type SocialflowNonprodRuntimeSeedSwitchSmokeReport = {
  ok: true;
  status: "RUNTIME_SEED_SWITCH_SMOKE_OK";
  configReports: SocialflowNonprodCanaryConfigReport[];
  runtimeSeedSwitch: "1";
  blockedReadSwitches: Record<(typeof FORBIDDEN_ON_SWITCHES)[number], "0">;
  deployable: false;
  remoteWrites: 0;
  deploy: false;
  oauthExcluded: true;
  configuredDatabases: string[];
  contractEvidence: ContractEvidence;
  rollbackReady: true;
  rollbackTarget: {
    switchName: typeof RUNTIME_SEED_SWITCH;
    switchValue: "0";
    configPaths: string[];
  };
};

type SmokeDependencies = {
  checkConfig?: (options: { configPath: string }) => SocialflowNonprodCanaryConfigReport;
  runContractTests?: (testPath: string) => void;
};

function hasProductiveToken(value: string): boolean {
  return /(^|[_\-\s])prod($|[_\-\s])/i.test(value);
}

function getBinding(report: SocialflowNonprodCanaryConfigReport, bindingName: string): CanaryBinding {
  const binding = report.bindings.find((candidate) => candidate.binding === bindingName);
  if (!binding) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_BINDING_MISSING:${report.configPath}:${bindingName}`);
  }
  return binding;
}

function assertBindingAlignment(reports: SocialflowNonprodCanaryConfigReport[]): Record<(typeof REQUIRED_BINDINGS)[number], CanaryBinding> {
  if (reports.length === 0) {
    throw new Error("SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_CONFIG_REPORTS_EMPTY");
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
          `SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_BINDING_MISMATCH:${bindingName}:${reference.databaseName}:${candidate.databaseName}`,
        );
      }
    }
  }

  return canonical;
}

function assertRuntimeSeedSwitchPosture(report: SocialflowNonprodCanaryConfigReport): void {
  if (report.status !== "NON_DEPLOYABLE_REAL_NONPROD_CONFIG") {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_UNSAFE_STATUS:${report.configPath}:${report.status}`);
  }
  if (report.deployable) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_DEPLOYABLE_BLOCKED:${report.configPath}`);
  }
  if (report.switches[RUNTIME_SEED_SWITCH] !== "1") {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_RUNTIME_SWITCH_NOT_ON:${report.configPath}:${report.switches[RUNTIME_SEED_SWITCH] ?? "missing"}`);
  }
  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_ROLLBACK_STATE_UNSAFE:${report.configPath}`);
  }
  for (const switchName of FORBIDDEN_ON_SWITCHES) {
    if (report.switches[switchName] !== "0") {
      throw new Error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_FORBIDDEN_SWITCH_ON:${report.configPath}:${switchName}:${report.switches[switchName] ?? "missing"}`);
    }
  }
  for (const binding of report.bindings) {
    if (hasProductiveToken(binding.databaseName)) {
      throw new Error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_SMOKE_PRODUCTIVE_DB:${binding.binding}:${binding.databaseName}`);
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
        [RUNTIME_SEED_SWITCH]: "1",
      },
      stdio: "inherit",
    },
  );
}

function parseArgs(argv: string[]): SmokeOptions & { json: boolean } {
  const contractTestArg = argv.find((arg) => arg.startsWith("--contract-test="));
  return {
    json: argv.includes("--json"),
    configPaths: argv.filter((arg) => arg.startsWith("--config=")).map((arg) => arg.slice("--config=".length)),
    contractTestPath: contractTestArg ? contractTestArg.slice("--contract-test=".length) : DEFAULT_CONTRACT_TEST_PATH,
  };
}

export async function runSmokeSocialflowNonprodRuntimeSeedSwitch(
  options: SmokeOptions = {},
  dependencies: SmokeDependencies = {},
): Promise<SocialflowNonprodRuntimeSeedSwitchSmokeReport> {
  const configPaths = options.configPaths?.length ? options.configPaths : [...DEFAULT_CONFIG_PATHS];
  const contractTestPath = options.contractTestPath ?? DEFAULT_CONTRACT_TEST_PATH;
  const checkConfig = dependencies.checkConfig ?? checkSocialflowNonprodCanaryConfig;
  const runContractTests = dependencies.runContractTests ?? defaultRunContractTests;

  const configReports = configPaths.map((configPath) => checkConfig({ configPath }));
  for (const report of configReports) {
    assertRuntimeSeedSwitchPosture(report);
  }
  const bindings = assertBindingAlignment(configReports);

  runContractTests(contractTestPath);

  return {
    ok: true,
    status: "RUNTIME_SEED_SWITCH_SMOKE_OK",
    configReports,
    runtimeSeedSwitch: "1",
    blockedReadSwitches: {
      SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH: "0",
      SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH: "0",
    },
    deployable: false,
    remoteWrites: 0,
    deploy: false,
    oauthExcluded: true,
    configuredDatabases: REQUIRED_BINDINGS.map((bindingName) => bindings[bindingName].databaseName),
    contractEvidence: {
      testPath: contractTestPath,
      switchEnv: RUNTIME_SEED_SWITCH,
      switchValue: "1",
      validatesSocialFirstRead: true,
      validatesCoreFallback: true,
      validatesSocialDbFailureFallback: true,
    },
    rollbackReady: true,
    rollbackTarget: {
      switchName: RUNTIME_SEED_SWITCH,
      switchValue: "0",
      configPaths,
    },
  };
}

export async function runSmokeSocialflowNonprodRuntimeSeedSwitchCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  try {
    const report = await runSmokeSocialflowNonprodRuntimeSeedSwitch(options);
    const summary = options.json ? { ok: report.ok, report } : {
      ok: report.ok,
      status: report.status,
      runtimeSeedSwitch: report.runtimeSeedSwitch,
      blockedReadSwitches: report.blockedReadSwitches,
      deployable: report.deployable,
      remoteWrites: report.remoteWrites,
      deploy: report.deploy,
      oauthExcluded: report.oauthExcluded,
      configuredDatabases: report.configuredDatabases,
      contractEvidence: report.contractEvidence,
      rollbackReady: report.rollbackReady,
      rollbackTarget: report.rollbackTarget,
    };
    console.log(JSON.stringify(summary, null, 2));
    console.log("SOCIALFLOW_NONPROD_RUNTIME_SEED_SWITCH_SMOKE_SUCCESS");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_RUNTIME_SEED_SWITCH_SMOKE_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  runSmokeSocialflowNonprodRuntimeSeedSwitchCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
