import { checkSocialflowPredeployGate } from "./check-socialflow-predeploy-gate";

type DryRunOptions = { json?: boolean };

export type SocialflowPredeployDryRunReport = {
  ok: true;
  status: "SOCIALFLOW_PREDEPLOY_DRY_RUN_OK";
  timestamp: string;
  predeployGateOk: true;
  deployNotExecuted: true;
  plannedCommands: string[];
  rollbackCommands: string[];
  smokeUrls: string[];
};

export async function runSocialflowPredeployDryRun(options: DryRunOptions): Promise<SocialflowPredeployDryRunReport> {
  const gateReport = await checkSocialflowPredeployGate({});

  if (gateReport.status !== "SOCIALFLOW_PREDEPLOY_GATE_READY") {
    throw new Error(`SOCIALFLOW_PREDEPLOY_DRY_RUN_GATE_NOT_READY:${gateReport.status}`);
  }

  return {
    ok: true,
    status: "SOCIALFLOW_PREDEPLOY_DRY_RUN_OK",
    timestamp: new Date().toISOString(),
    predeployGateOk: true,
    deployNotExecuted: true,
    plannedCommands: [
      "cd apps/socialflow-runtime && pnpm build",
      "cd apps/socialflow-runtime && wrangler deploy --config wrangler.toml",
      "cd workers/socialflows-runtime-canary && wrangler deploy --config wrangler.workers.toml",
    ],
    rollbackCommands: [
      "Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = \"false\" in wrangler.toml files",
      "Or set all switches to \"0\" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE",
      "Re-deploy with rollback config",
    ],
    smokeUrls: [
      "https://socialflow-canary.drako.systems/health",
      "https://socialflow-canary.drako.systems/api/socialflow/status",
    ],
  };
}

async function runSocialflowPredeployDryRunCli(argv: string[]): Promise<number> {
  const json = argv.includes("--json");

  try {
    const report = await runSocialflowPredeployDryRun({ json });

    if (json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log(JSON.stringify(report, null, 2));
      console.log("SOCIALFLOW_PREDEPLOY_DRY_RUN_SUCCESS");
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
    const exitCode = await runSocialflowPredeployDryRunCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
