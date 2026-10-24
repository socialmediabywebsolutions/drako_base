import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runBackfillSocialflowLegacyReadModels } from "./backfill-socialflow-legacy-read-models";
import {
  resolveLegacyParityExitCode,
  runCheckSocialflowLegacyReadModelsParity,
} from "./check-socialflow-legacy-read-models-parity";
import { runBootstrapSocialflowLegacyReadModelsSmokeLocal } from "./bootstrap-socialflow-legacy-read-models-smoke-local";

type ValidationOptions = {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
};

const REQUIRED_MIGRATION = "migrations/0190_socialflow_legacy_read_models.sql";

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
    throw new Error(`SOCIALFLOW_LEGACY_READ_MODELS_VALIDATION_MIGRATION_MISSING:${REQUIRED_MIGRATION}`);
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
  console.log(`\n[SocialFlow Legacy Read Models Validation] ${title}`);
}

export async function runValidateSocialflowLegacyReadModelsLocal(options: ValidationOptions): Promise<void> {
  printStep("1/6 verify required migration exists");
  assertRequiredMigrationExists();
  console.log(`migration=${REQUIRED_MIGRATION} status=ok`);

  printStep("2/6 bootstrap local schema for legacy read models");
  const bootstrapReport = await runBootstrapSocialflowLegacyReadModelsSmokeLocal({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
    dryRun: false,
  });
  console.log(`bootstrapReport=${JSON.stringify(bootstrapReport)}`);

  printStep("3/6 run backfill dry-run (local only)");
  const dryRunReport = await runBackfillSocialflowLegacyReadModels({
    dryRun: true,
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });
  console.log(`dryRunReport=${JSON.stringify(dryRunReport)}`);

  printStep("4/6 run backfill apply (local only)");
  const applyReport = await runBackfillSocialflowLegacyReadModels({
    dryRun: false,
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });
  console.log(`applyReport=${JSON.stringify(applyReport)}`);

  printStep("5/6 run strict parity check (no allow-drift)");
  const parityReport = await runCheckSocialflowLegacyReadModelsParity({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });
  const parityExitCode = resolveLegacyParityExitCode(parityReport, false);
  if (parityExitCode !== 0) {
    throw new Error("SOCIALFLOW_LEGACY_READ_MODELS_VALIDATION_PARITY_DRIFT_DETECTED");
  }
  console.log("parity=strict-ok");

  printStep("6/6 run legacy prep/backfill/parity tests");
  runCommand("npx", [
    "vitest",
    "run",
    "tests/lib/socialflow-legacy-social-ownership-prep-contract.test.ts",
    "tests/backfill-socialflow-legacy-read-models.test.ts",
    "tests/check-socialflow-legacy-read-models-parity.test.ts",
  ]);

  console.log("\nSOCIALFLOW_LEGACY_READ_MODELS_VALIDATION_LOCAL_SUCCESS");
  console.log("This validation is local-only, does not use remote D1, and does not activate any switch.");
}

export async function runValidateSocialflowLegacyReadModelsLocalCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    await runValidateSocialflowLegacyReadModelsLocal(options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_LEGACY_READ_MODELS_VALIDATION_LOCAL_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const exitCode = await runValidateSocialflowLegacyReadModelsLocalCli(process.argv.slice(2));
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
