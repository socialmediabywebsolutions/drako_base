import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runBackfillSocialflowOAuthConnections } from "./backfill-socialflow-oauth-connections";
import {
  resolveOAuthParityExitCode,
  runCheckSocialflowOAuthConnectionsParity,
} from "./check-socialflow-oauth-connections-parity";

type ValidationOptions = {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  encryptionSecret: string | null;
};

const REQUIRED_MIGRATION = "migrations/0189_socialflow_oauth_connections.sql";

function parseArgs(argv: string[]): ValidationOptions {
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const secretArg = argv.find((value) => value.startsWith("--encryption-secret="));

  return {
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    encryptionSecret: secretArg ? secretArg.slice("--encryption-secret=".length) : null,
  };
}

function assertRequiredMigrationExists(): void {
  const migrationPath = path.resolve(process.cwd(), REQUIRED_MIGRATION);
  if (!existsSync(migrationPath)) {
    throw new Error(`SOCIALFLOW_OAUTH_CONNECTIONS_VALIDATION_MIGRATION_MISSING:${REQUIRED_MIGRATION}`);
  }
}

function runCommand(command: string, args: string[]): void {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
}

function printStep(title: string): void {
  console.log(`\n[SocialFlow OAuth Connections Validation] ${title}`);
}

export async function runValidateSocialflowOAuthConnectionsLocal(options: ValidationOptions): Promise<void> {
  printStep("1/5 verify required migration exists");
  assertRequiredMigrationExists();
  console.log(`migration=${REQUIRED_MIGRATION} status=ok`);

  printStep("2/5 run backfill dry-run (local only)");
  const dryRunReport = await runBackfillSocialflowOAuthConnections({
    dryRun: true,
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
    encryptionSecret: options.encryptionSecret,
  });
  console.log(`dryRunReport=${JSON.stringify(dryRunReport)}`);

  printStep("3/5 run backfill apply (local only)");
  const applyReport = await runBackfillSocialflowOAuthConnections({
    dryRun: false,
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
    encryptionSecret: options.encryptionSecret,
  });
  console.log(`applyReport=${JSON.stringify(applyReport)}`);

  printStep("4/5 run strict parity check (no allow-drift)");
  const parityReport = await runCheckSocialflowOAuthConnectionsParity({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
    encryptionSecret: options.encryptionSecret,
  });
  const parityExitCode = resolveOAuthParityExitCode(parityReport, false);
  if (parityExitCode !== 0) {
    throw new Error("SOCIALFLOW_OAUTH_CONNECTIONS_VALIDATION_PARITY_DRIFT_DETECTED");
  }
  console.log("parity=strict-ok");

  printStep("5/5 run oauth/backfill/parity tests");
  runCommand("npx", [
    "vitest",
    "run",
    "tests/lib/socialflow-linkedin-oauth.test.ts",
    "tests/lib/socialflow-linkedin-oauth-social-ownership-prep-contract.test.ts",
    "tests/backfill-socialflow-oauth-connections.test.ts",
    "tests/check-socialflow-oauth-connections-parity.test.ts",
  ]);

  console.log("\nSOCIALFLOW_OAUTH_CONNECTIONS_VALIDATION_LOCAL_SUCCESS");
  console.log("This validation is local-only, does not use remote D1, and does not activate any OAuth switch.");
}

export async function runValidateSocialflowOAuthConnectionsLocalCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    await runValidateSocialflowOAuthConnectionsLocal(options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_OAUTH_CONNECTIONS_VALIDATION_LOCAL_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const exitCode = await runValidateSocialflowOAuthConnectionsLocalCli(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
