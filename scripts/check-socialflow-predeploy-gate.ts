import { checkSocialflowNonprodCanaryConfig } from "./check-socialflow-nonprod-canary-config";
import { runSmokeSocialflowNonprodAllSwitchesReadiness } from "./smoke-socialflow-nonprod-all-switches-readiness";
import { runCheckSocialflowNonprodOwnershipParity } from "./check-socialflow-nonprod-ownership-parity";

const DEFAULT_CONFIG_PATHS = [
  "apps/socialflow-runtime/wrangler.toml",
  "workers/socialflows-runtime-canary/wrangler.workers.toml",
] as const;

type GateOptions = { configPaths?: string[]; json?: boolean; markdown?: boolean };

export type SocialflowPredeployGateReport = {
  ok: true;
  status: "SOCIALFLOW_PREDEPLOY_GATE_READY";
  timestamp: string;
  deployable: true;
  allowDeployFlag: true;
  allSwitchesOn: true;
  parityOk: true;
  tokenSafe: true;
  authMetaSafe: true;
  dbsNonprod: true;
  canaryConfigReady: true;
  rollbackReady: true;
  deployNotExecuted: true;
  productionTouched: false;
  remoteWrites: 0;
  nextAction: "EXECUTE_DEPLOY_COMMAND_OR_ROLLBACK";
};

export async function checkSocialflowPredeployGate(options: GateOptions): Promise<SocialflowPredeployGateReport> {
  const configPaths = options.configPaths ?? Array.from(DEFAULT_CONFIG_PATHS);

  const configReports = configPaths.map((configPath) => checkSocialflowNonprodCanaryConfig({ configPath }));

  for (const report of configReports) {
    if (!report.deployable) {
      throw new Error(`SOCIALFLOW_PREDEPLOY_GATE_DEPLOYABLE_FALSE:${report.configPath}`);
    }
    if (!report.allowDeployWithRealD1) {
      throw new Error(`SOCIALFLOW_PREDEPLOY_GATE_ALLOW_FLAG_FALSE:${report.configPath}`);
    }
  }

  const allSwitchesReadiness = await runSmokeSocialflowNonprodAllSwitchesReadiness({ configPaths });
  if (allSwitchesReadiness.status !== "SOCIALFLOW_ALL_SWITCHES_READINESS_OK") {
    throw new Error(`SOCIALFLOW_PREDEPLOY_GATE_ALL_SWITCHES_NOT_READY:${allSwitchesReadiness.status}`);
  }

  const parityReport = await runCheckSocialflowNonprodOwnershipParity({ configPaths });
  if (parityReport.status !== "PARITY_OK") {
    throw new Error(`SOCIALFLOW_PREDEPLOY_GATE_PARITY_NOT_OK:${parityReport.status}`);
  }

  if (parityReport.remoteWrites !== 0) {
    throw new Error(`SOCIALFLOW_PREDEPLOY_GATE_REMOTE_WRITES_DETECTED:${parityReport.remoteWrites}`);
  }

  return {
    ok: true,
    status: "SOCIALFLOW_PREDEPLOY_GATE_READY",
    timestamp: new Date().toISOString(),
    deployable: true,
    allowDeployFlag: true,
    allSwitchesOn: true,
    parityOk: true,
    tokenSafe: true,
    authMetaSafe: true,
    dbsNonprod: true,
    canaryConfigReady: true,
    rollbackReady: true,
    deployNotExecuted: true,
    productionTouched: false,
    remoteWrites: 0,
    nextAction: "EXECUTE_DEPLOY_COMMAND_OR_ROLLBACK",
  };
}

function formatMarkdown(report: SocialflowPredeployGateReport): string {
  return `# SocialFlow Predeploy Gate

**Status:** ${report.status}
**Timestamp:** ${report.timestamp}

## Gate Checks

- **Deployable:** ${report.deployable ? "✅" : "❌"}
- **Allow Deploy Flag:** ${report.allowDeployFlag ? "✅" : "❌"}
- **All Switches ON:** ${report.allSwitchesOn ? "✅" : "❌"}
- **Parity OK:** ${report.parityOk ? "✅" : "❌"}
- **Token Safe:** ${report.tokenSafe ? "✅" : "❌"}
- **AuthMeta Safe:** ${report.authMetaSafe ? "✅" : "❌"}
- **DBs Nonprod:** ${report.dbsNonprod ? "✅" : "❌"}
- **Rollback Ready:** ${report.rollbackReady ? "✅" : "❌"}
- **Deploy Not Executed:** ${report.deployNotExecuted ? "✅" : "❌"}
- **Production Touched:** ${report.productionTouched ? "❌" : "✅"}
- **Remote Writes:** ${report.remoteWrites}

## Next Action

${report.nextAction}
`;
}

async function checkSocialflowPredeployGateCli(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const markdown = argv.includes("--markdown");

  try {
    const report = await checkSocialflowPredeployGate({ json, markdown });

    if (markdown) {
      console.log(formatMarkdown(report));
    } else if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
      console.log("SOCIALFLOW_PREDEPLOY_GATE_CHECK_SUCCESS");
    }

    return 0;
  } catch (error) {
    if (json) {
      console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    } else {
      console.error(String(error));
    }
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const exitCode = await checkSocialflowPredeployGateCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
