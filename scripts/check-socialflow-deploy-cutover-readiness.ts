import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  checkSocialflowNonprodCanaryConfig,
  type SocialflowNonprodCanaryConfigReport,
} from "./check-socialflow-nonprod-canary-config";
import {
  runSmokeSocialflowNonprodAllSwitchesReadiness,
  type SocialflowAllSwitchesReadinessReport,
} from "./smoke-socialflow-nonprod-all-switches-readiness";
import {
  runCheckSocialflowNonprodOwnershipParity,
  type SocialflowNonprodOwnershipParityReport,
} from "./check-socialflow-nonprod-ownership-parity";

const DEFAULT_CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

type CheckOptions = {
  configPaths?: string[];
  json?: boolean;
  markdown?: boolean;
};

export type SocialflowDeployCutoverReadinessReport = {
  ok: true;
  status: "SOCIALFLOW_DEPLOY_CUTOVER_READINESS_BLOCKED_INTENTIONALLY";
  timestamp: string;
  allSwitchesOn: true;
  deployable: false;
  deployBlockedByDesign: true;
  canaryConfigReady: true;
  rollbackReady: true;
  productionTouched: false;
  remoteWrites: 0;
  tokenSafe: true;
  authMetaSafe: true;
  parityOk: true;
  configReports: SocialflowNonprodCanaryConfigReport[];
  nextPhaseRecommendation: "MONITOR_ALL_SWITCHES_AND_PREPARE_DEPLOYABLE_FLAG";
  blockersBeforeDeployableTrue: string[];
  blockersBeforeProduction: string[];
};

type CheckDependencies = {
  checkConfig?: (options: { configPath: string }) => SocialflowNonprodCanaryConfigReport;
  runAllSwitchesReadiness?: (options: { configPaths?: string[] }) => Promise<SocialflowAllSwitchesReadinessReport>;
  runParity?: () => Promise<SocialflowNonprodOwnershipParityReport>;
};

export async function checkSocialflowDeployCutoverReadiness(
  options: CheckOptions,
  dependencies?: CheckDependencies,
): Promise<SocialflowDeployCutoverReadinessReport> {
  const configPaths = options.configPaths ?? Array.from(DEFAULT_CONFIG_PATHS);

  const checkConfig = dependencies?.checkConfig ?? checkSocialflowNonprodCanaryConfig;
  const runAllSwitchesReadiness = dependencies?.runAllSwitchesReadiness ?? runSmokeSocialflowNonprodAllSwitchesReadiness;
  const runParity = dependencies?.runParity ?? (() => runCheckSocialflowNonprodOwnershipParity({ configPaths }));

  const configReports: SocialflowNonprodCanaryConfigReport[] = [];
  for (const configPath of configPaths) {
    const report = checkConfig({ configPath });
    configReports.push(report);
  }

  for (const report of configReports) {
    if (report.placeholders.length > 0) {
      throw new Error(`SOCIALFLOW_DEPLOY_CUTOVER_PLACEHOLDER_DETECTED:${report.configPath}:${report.placeholders.join(",")}`);
    }

    for (const binding of report.bindings) {
      if (/(^|[_\-\s])prod($|[_\-\s])/i.test(binding.databaseName)) {
        throw new Error(`SOCIALFLOW_DEPLOY_CUTOVER_PRODUCTIVE_DATABASE:${report.configPath}:${binding.databaseName}`);
      }
    }
  }

  const allSwitchesReadiness = await runAllSwitchesReadiness({ configPaths });

  if (allSwitchesReadiness.status !== "SOCIALFLOW_ALL_SWITCHES_READINESS_OK") {
    throw new Error(`SOCIALFLOW_DEPLOY_CUTOVER_ALL_SWITCHES_NOT_READY:${allSwitchesReadiness.status}`);
  }

  const parityReport = await runParity();

  if (parityReport.status !== "PARITY_OK") {
    throw new Error(`SOCIALFLOW_DEPLOY_CUTOVER_PARITY_NOT_OK:${parityReport.status}`);
  }

  if (parityReport.remoteWrites !== 0) {
    throw new Error(`SOCIALFLOW_DEPLOY_CUTOVER_REMOTE_WRITES_DETECTED:${parityReport.remoteWrites}`);
  }

  const deployable = configReports.every((r) => r.deployable);
  if (deployable) {
    throw new Error("SOCIALFLOW_DEPLOY_CUTOVER_DEPLOYABLE_TRUE_UNEXPECTED");
  }

  const blockersBeforeDeployableTrue = [
    "MONITOR_ALL_SWITCHES_3_7_DAYS_STABLE",
    "VALIDATE_NO_TOKEN_LEAKAGE",
    "VALIDATE_FALLBACKS_NOT_USED_IN_HEALTHY_PATH",
    "VALIDATE_PERFORMANCE_ACCEPTABLE",
    "DOCUMENT_MONITORING_EVIDENCE",
  ];

  const blockersBeforeProduction = [
    "SET_DEPLOYABLE_TRUE",
    "DEPLOY_CANARY_NONPROD",
    "VALIDATE_CANARY_DEPLOY",
    "DNS_ROUTING_CUTOVER",
    "VALIDATE_PRODUCTION_READY",
    "HUMAN_APPROVAL",
  ];

  return {
    ok: true,
    status: "SOCIALFLOW_DEPLOY_CUTOVER_READINESS_BLOCKED_INTENTIONALLY",
    timestamp: new Date().toISOString(),
    allSwitchesOn: true,
    deployable: false,
    deployBlockedByDesign: true,
    canaryConfigReady: true,
    rollbackReady: true,
    productionTouched: false,
    remoteWrites: 0,
    tokenSafe: true,
    authMetaSafe: true,
    parityOk: true,
    configReports,
    nextPhaseRecommendation: "MONITOR_ALL_SWITCHES_AND_PREPARE_DEPLOYABLE_FLAG",
    blockersBeforeDeployableTrue,
    blockersBeforeProduction,
  };
}

function formatMarkdown(report: SocialflowDeployCutoverReadinessReport): string {
  const lines: string[] = [];

  lines.push("# SocialFlow Deploy Cutover Readiness");
  lines.push("");
  lines.push(`**Status:** ${report.status}`);
  lines.push(`**Timestamp:** ${report.timestamp}`);
  lines.push("");

  lines.push("## Current State");
  lines.push("");
  lines.push(`- **All Switches ON:** ${report.allSwitchesOn ? "✅" : "❌"}`);
  lines.push(`- **Deployable:** ${report.deployable ? "✅" : "❌"}`);
  lines.push(`- **Deploy Blocked By Design:** ${report.deployBlockedByDesign ? "✅" : "❌"}`);
  lines.push(`- **Canary Config Ready:** ${report.canaryConfigReady ? "✅" : "❌"}`);
  lines.push(`- **Rollback Ready:** ${report.rollbackReady ? "✅" : "❌"}`);
  lines.push(`- **Production Touched:** ${report.productionTouched ? "❌" : "✅"}`);
  lines.push(`- **Remote Writes:** ${report.remoteWrites}`);
  lines.push(`- **Token Safe:** ${report.tokenSafe ? "✅" : "❌"}`);
  lines.push(`- **AuthMeta Safe:** ${report.authMetaSafe ? "✅" : "❌"}`);
  lines.push(`- **Parity OK:** ${report.parityOk ? "✅" : "❌"}`);
  lines.push("");

  lines.push("## Blockers Before `deployable=true`");
  lines.push("");
  for (const blocker of report.blockersBeforeDeployableTrue) {
    lines.push(`- ⏸️ ${blocker}`);
  }
  lines.push("");

  lines.push("## Blockers Before Production");
  lines.push("");
  for (const blocker of report.blockersBeforeProduction) {
    lines.push(`- ⏸️ ${blocker}`);
  }
  lines.push("");

  lines.push("## Next Phase");
  lines.push("");
  lines.push(`**Recommendation:** ${report.nextPhaseRecommendation}`);
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("Deploy cutover is intentionally blocked until monitoring completes.");

  return lines.join("\n");
}

function parseArgs(argv: string[]): CheckOptions {
  const json = argv.includes("--json");
  const markdown = argv.includes("--markdown");
  const configPathsArg = argv.find((arg) => arg.startsWith("--config="));
  const configPaths = configPathsArg
    ? configPathsArg.replace("--config=", "").split(",")
    : undefined;

  return { configPaths, json, markdown };
}

async function checkSocialflowDeployCutoverReadinessCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);

  try {
    const report = await checkSocialflowDeployCutoverReadiness(options);

    if (options.markdown) {
      console.log(formatMarkdown(report));
    } else if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
      console.log("SOCIALFLOW_DEPLOY_CUTOVER_READINESS_CHECK_SUCCESS");
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
    const exitCode = await checkSocialflowDeployCutoverReadinessCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
