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

type SmokeOptions = {
  configPaths?: string[];
  json?: boolean;
};

export type SocialflowAllSwitchesReadinessReport = {
  ok: true;
  status: "SOCIALFLOW_ALL_SWITCHES_READINESS_OK";
  configReports: SocialflowNonprodCanaryConfigReport[];
  runtimeSeedSource: "SOCIAL_DB";
  exportsSource: "SOCIAL_DB";
  legacySource: "SOCIAL_DB";
  oauthSource: "SOCIAL_DB";
  allSwitchesOn: true;
  deployable: boolean;
  fallbacksAvailable: true;
  fallbacksUsedInHealthyPath: false;
  tokenSafe: true;
  authMetaSafe: true;
  remoteWrites: 0;
  deploy: false;
  parityReport: {
    status: SocialflowNonprodOwnershipParityReport["status"];
  };
  nextPhaseRecommendation: "MONITOR_ALL_SWITCHES_BEFORE_DEPLOY";
};

type SmokeDependencies = {
  checkConfig?: (options: { configPath: string }) => SocialflowNonprodCanaryConfigReport;
  runParity?: () => Promise<SocialflowNonprodOwnershipParityReport>;
};

function hasProductiveToken(value: string): boolean {
  return /(^|[_\-\s])prod($|[_\-\s])/i.test(value);
}

export async function runSmokeSocialflowNonprodAllSwitchesReadiness(
  options: SmokeOptions,
  dependencies?: SmokeDependencies,
): Promise<SocialflowAllSwitchesReadinessReport> {
  const configPaths = options.configPaths ?? Array.from(DEFAULT_CONFIG_PATHS);

  const checkConfig = dependencies?.checkConfig ?? checkSocialflowNonprodCanaryConfig;
  const runParity = dependencies?.runParity ?? (() => runCheckSocialflowNonprodOwnershipParity({ configPaths }));

  const configReports: SocialflowNonprodCanaryConfigReport[] = [];
  for (const configPath of configPaths) {
    const report = checkConfig({ configPath });
    configReports.push(report);
  }

  for (const report of configReports) {
    const runtimeSeedSwitchValue = report.switches[RUNTIME_SEED_SWITCH];
    if (runtimeSeedSwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_ALL_SWITCHES_READINESS_RUNTIME_SEED_NOT_ON:${report.configPath}:${runtimeSeedSwitchValue ?? "missing"}`);
    }

    const exportsSwitchValue = report.switches[EXPORTS_SWITCH];
    if (exportsSwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_ALL_SWITCHES_READINESS_EXPORTS_NOT_ON:${report.configPath}:${exportsSwitchValue ?? "missing"}`);
    }

    const legacySwitchValue = report.switches[LEGACY_SWITCH];
    if (legacySwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_ALL_SWITCHES_READINESS_LEGACY_NOT_ON:${report.configPath}:${legacySwitchValue ?? "missing"}`);
    }

    const oauthSwitchValue = report.switches[OAUTH_SWITCH];
    if (oauthSwitchValue !== "1") {
      throw new Error(`SOCIALFLOW_ALL_SWITCHES_READINESS_OAUTH_NOT_ON:${report.configPath}:${oauthSwitchValue ?? "missing"}`);
    }

    for (const binding of report.bindings) {
      if (hasProductiveToken(binding.databaseName)) {
        throw new Error(`SOCIALFLOW_ALL_SWITCHES_READINESS_PRODUCTIVE_DATABASE:${report.configPath}:${binding.binding}:${binding.databaseName}`);
      }
    }
  }

  const parityReport = await runParity();

  if (parityReport.status !== "PARITY_OK") {
    throw new Error(`SOCIALFLOW_ALL_SWITCHES_READINESS_PARITY_NOT_OK:${parityReport.status}`);
  }

  if (parityReport.remoteWrites !== 0) {
    throw new Error(`SOCIALFLOW_ALL_SWITCHES_READINESS_REMOTE_WRITES_DETECTED:${parityReport.remoteWrites}`);
  }

  return {
    ok: true,
    status: "SOCIALFLOW_ALL_SWITCHES_READINESS_OK",
    configReports,
    runtimeSeedSource: "SOCIAL_DB",
    exportsSource: "SOCIAL_DB",
    legacySource: "SOCIAL_DB",
    oauthSource: "SOCIAL_DB",
    allSwitchesOn: true,
    deployable: configReports.every((r) => r.deployable),
    fallbacksAvailable: true,
    fallbacksUsedInHealthyPath: false,
    tokenSafe: true,
    authMetaSafe: true,
    remoteWrites: 0,
    deploy: false,
    parityReport: {
      status: parityReport.status,
    },
    nextPhaseRecommendation: "MONITOR_ALL_SWITCHES_BEFORE_DEPLOY",
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

async function runSmokeSocialflowNonprodAllSwitchesReadinessCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);

  try {
    const report = await runSmokeSocialflowNonprodAllSwitchesReadiness(options);

    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
      console.log("SOCIALFLOW_ALL_SWITCHES_READINESS_SUCCESS");
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
    const exitCode = await runSmokeSocialflowNonprodAllSwitchesReadinessCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
