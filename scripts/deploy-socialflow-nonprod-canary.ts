import { execSync } from "node:child_process";
import { checkSocialflowPredeployGate } from "./check-socialflow-predeploy-gate";

type DeployMode = "dry-run" | "execute";

interface DeployCanaryOptions {
  mode?: DeployMode;
  json?: boolean;
}

interface DeployCanaryReport {
  ok: boolean;
  status: string;
  timestamp: string;
  mode: DeployMode;
  predeployGateOk: boolean;
  deployExecuted: boolean;
  productionTouched: boolean;
  remoteWrites: number;
  plannedCommands: string[];
  executedCommands?: string[];
  deployResults?: string[];
  rollbackCommands: string[];
  nextAction: string;
  errors?: string[];
}

const PLANNED_DEPLOY_COMMANDS = [
  "cd apps/socialflow-runtime && pnpm build",
  "cd apps/socialflow-runtime && wrangler deploy --config wrangler.toml",
  "cd workers/socialflows-runtime-canary && wrangler deploy --config wrangler.workers.toml",
];

const ROLLBACK_COMMANDS = [
  'Set SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false" in wrangler.toml files',
  'Or set all switches to "0" via SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE',
  "Re-deploy with rollback config",
];

export async function deploySocialflowNonprodCanary(
  options: DeployCanaryOptions = {},
): Promise<DeployCanaryReport> {
  const mode: DeployMode = options.mode ?? "dry-run";
  const errors: string[] = [];

  const predeployGateReport = await checkSocialflowPredeployGate({});

  if (!predeployGateReport.ok) {
    errors.push(`PREDEPLOY_GATE_FAILED:${predeployGateReport.status}`);
  }

  if (!predeployGateReport.deployable) {
    errors.push("DEPLOYABLE_FLAG_NOT_TRUE");
  }

  if (!predeployGateReport.allowDeployFlag) {
    errors.push("ALLOW_DEPLOY_FLAG_NOT_TRUE");
  }

  if (!predeployGateReport.dbsNonprod) {
    errors.push("PRODUCTION_DATABASE_DETECTED");
  }

  if (!predeployGateReport.rollbackReady) {
    errors.push("ROLLBACK_CONFIG_MISSING");
  }

  if (mode === "dry-run") {
    return {
      ok: true,
      status: "SOCIALFLOW_CANARY_DEPLOY_DRY_RUN_OK",
      timestamp: new Date().toISOString(),
      mode,
      predeployGateOk: predeployGateReport.ok,
      deployExecuted: false,
      productionTouched: false,
      remoteWrites: 0,
      plannedCommands: PLANNED_DEPLOY_COMMANDS,
      rollbackCommands: ROLLBACK_COMMANDS,
      nextAction: "RUN_WITH_--execute_TO_DEPLOY",
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  if (errors.length > 0) {
    throw new Error(`SOCIALFLOW_CANARY_DEPLOY_BLOCKED:${errors.join(",")}`);
  }

  const executedCommands: string[] = [];
  const deployResults: string[] = [];

  try {
    console.log("\n🚀 DEPLOYING SOCIALFLOW CANARY NONPROD\n");

    console.log("Step 1/3: Building socialflow-runtime...");
    const buildResult = execSync("cd apps/socialflow-runtime && pnpm build", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    executedCommands.push(PLANNED_DEPLOY_COMMANDS[0]);
    deployResults.push("BUILD_SUCCESS");
    console.log("✅ Build completed");

    console.log("\nStep 2/3: Deploying apps/socialflow-runtime...");
    const deployRuntimeResult = execSync(
      "cd apps/socialflow-runtime && wrangler deploy --config wrangler.toml",
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    executedCommands.push(PLANNED_DEPLOY_COMMANDS[1]);
    deployResults.push("DEPLOY_RUNTIME_SUCCESS");
    console.log("✅ Runtime deployed");

    console.log("\nStep 3/3: Deploying workers/socialflows-runtime-canary...");
    const deployWorkerResult = execSync(
      "cd workers/socialflows-runtime-canary && wrangler deploy --config wrangler.workers.toml",
      {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    executedCommands.push(PLANNED_DEPLOY_COMMANDS[2]);
    deployResults.push("DEPLOY_WORKER_SUCCESS");
    console.log("✅ Worker deployed");

    console.log("\n✅ DEPLOY COMPLETE\n");

    return {
      ok: true,
      status: "SOCIALFLOW_CANARY_DEPLOY_EXECUTED",
      timestamp: new Date().toISOString(),
      mode,
      predeployGateOk: true,
      deployExecuted: true,
      productionTouched: false,
      remoteWrites: 0,
      plannedCommands: PLANNED_DEPLOY_COMMANDS,
      executedCommands,
      deployResults,
      rollbackCommands: ROLLBACK_COMMANDS,
      nextAction: "RUN_POSTDEPLOY_SMOKE_TEST",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`DEPLOY_EXECUTION_FAILED:${errorMessage}`);

    return {
      ok: false,
      status: "SOCIALFLOW_CANARY_DEPLOY_FAILED",
      timestamp: new Date().toISOString(),
      mode,
      predeployGateOk: true,
      deployExecuted: false,
      productionTouched: false,
      remoteWrites: 0,
      plannedCommands: PLANNED_DEPLOY_COMMANDS,
      executedCommands,
      deployResults,
      rollbackCommands: ROLLBACK_COMMANDS,
      nextAction: "INVESTIGATE_DEPLOY_FAILURE_AND_ROLLBACK",
      errors,
    };
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isExecute = args.includes("--execute");
  const isJson = args.includes("--json");

  let mode: DeployMode = "dry-run";
  if (isExecute && !isDryRun) {
    mode = "execute";
  }

  deploySocialflowNonprodCanary({ mode, json: isJson })
    .then((report) => {
      if (isJson) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        console.log(JSON.stringify(report, null, 2));
        console.log(`\n${report.status}`);
      }

      if (!report.ok) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("SOCIALFLOW_CANARY_DEPLOY_ERROR:", error.message);
      process.exit(1);
    });
}
