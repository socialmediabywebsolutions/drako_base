import { existsSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { runBackfillSocialflowRuntimeSeed } from "./backfill-socialflow-runtime-seed";
import { resolveParityExitCode, runCheckSocialflowRuntimeSeedParity } from "./check-socialflow-runtime-seed-parity";

type ValidationOptions = {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
};

const REQUIRED_MIGRATION = "migrations/0187_socialflow_seed_metadata.sql";

function parseArgs(argv: string[]): ValidationOptions {
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));

  return {
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
  };
}

function assertRequiredMigrationExists(): void {
  const migrationPath = path.resolve(process.cwd(), REQUIRED_MIGRATION);
  if (!existsSync(migrationPath)) {
    throw new Error(`SOCIALFLOW_RUNTIME_SEED_VALIDATION_MIGRATION_MISSING: ${REQUIRED_MIGRATION}`);
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
  console.log(`\n[SocialFlow Runtime Seed Validation] ${title}`);
}

export async function runValidateSocialflowRuntimeSeedLocal(options: ValidationOptions): Promise<void> {
  printStep("1/5 verify required migration exists");
  assertRequiredMigrationExists();
  console.log(`migration=${REQUIRED_MIGRATION} status=ok`);

  printStep("2/5 run backfill dry-run (local only)");
  const dryRunReport = await runBackfillSocialflowRuntimeSeed({
    dryRun: true,
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });
  console.log(`dryRunReport=${JSON.stringify(dryRunReport)}`);

  printStep("3/5 run backfill apply (local only)");
  const applyReport = await runBackfillSocialflowRuntimeSeed({
    dryRun: false,
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });
  console.log(`applyReport=${JSON.stringify(applyReport)}`);

  printStep("4/5 run strict parity check (no allow-drift)");
  const parityReport = await runCheckSocialflowRuntimeSeedParity({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });
  const parityExitCode = resolveParityExitCode(parityReport, false);
  if (parityExitCode !== 0) {
    throw new Error("SOCIALFLOW_RUNTIME_SEED_VALIDATION_PARITY_DRIFT_DETECTED");
  }
  console.log("parity=strict-ok");

  printStep("5/5 run runtime seed contract tests");
  runCommand("npx", ["vitest", "run", "tests/lib/socialflow-runtime-seed-contract.test.ts"]);

  console.log("\nSOCIALFLOW_RUNTIME_SEED_VALIDATION_LOCAL_SUCCESS");
  console.log(
    "Local switch probe command (manual, optional): SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH=1 npx vitest run tests/lib/socialflow-runtime-seed-contract.test.ts",
  );
}

export async function runValidateSocialflowRuntimeSeedLocalCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    await runValidateSocialflowRuntimeSeedLocal(options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_RUNTIME_SEED_VALIDATION_LOCAL_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const exitCode = await runValidateSocialflowRuntimeSeedLocalCli(process.argv.slice(2));
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
