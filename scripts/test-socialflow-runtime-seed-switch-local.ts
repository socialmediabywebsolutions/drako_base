import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runValidateSocialflowRuntimeSeedLocal } from "./validate-socialflow-runtime-seed-local";

type SwitchTestOptions = {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
};

function parseArgs(argv: string[]): SwitchTestOptions {
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));

  return {
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
  };
}

function runCommand(command: string, args: string[], envPatch?: Record<string, string>): void {
  execFileSync(command, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(envPatch ?? {}),
    },
    stdio: "inherit",
  });
}

export async function runTestSocialflowRuntimeSeedSwitchLocal(options: SwitchTestOptions): Promise<void> {
  console.log("\n[SocialFlow Runtime Seed Switch Local Test] 1/2 run baseline local validation pack");
  await runValidateSocialflowRuntimeSeedLocal({
    configPath: options.configPath,
    dracoBinding: options.dracoBinding,
    socialBinding: options.socialBinding,
  });

  console.log("\n[SocialFlow Runtime Seed Switch Local Test] 2/2 run runtime seed contract suite with switch=1");
  runCommand(
    "npx",
    [
      "vitest",
      "run",
      "tests/lib/socialflow-runtime-seed-contract.test.ts",
      "--reporter=verbose",
    ],
    { SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH: "1" },
  );

  console.log("\nSOCIALFLOW_RUNTIME_SEED_SWITCH_LOCAL_TEST_SUCCESS");
  console.log("Validated scenarios (from runtime-seed contract suite):");
  console.log("- switch off -> core fallback");
  console.log("- switch on + active seed -> social-first");
  console.log("- switch on + missing/inactive seed -> core fallback");
  console.log("- switch on + SOCIAL_DB error -> core fallback");
}

export async function runTestSocialflowRuntimeSeedSwitchLocalCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    await runTestSocialflowRuntimeSeedSwitchLocal(options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_RUNTIME_SEED_SWITCH_LOCAL_TEST_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const exitCode = await runTestSocialflowRuntimeSeedSwitchLocalCli(process.argv.slice(2));
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
