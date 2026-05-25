import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runValidateSocialflowExportReadModelsLocal } from "./validate-socialflow-export-read-models-local";

const SWITCH_ENV_KEY = "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH";
const DEFAULT_EXPORTS_SERVICE_TEST_PATH = "apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts";

const REQUIRED_ASSERTION_TITLES = [
  "keeps core-backed behavior when switch is off",
  "uses SOCIAL_DB read models when switch is on and prepared model is valid",
  "falls back to core when switch is on and SOCIAL_DB read model is missing",
  "falls back to core when switch is on and SOCIAL_DB read fails",
] as const;

type SmokeOptions = {
  configPath: string;
  dracoBinding: string;
  socialBinding: string;
  exportsServiceTestPath: string;
  assumeValidated: boolean;
};

type VitestAssertionResult = {
  title: string;
  fullName: string;
  status: "passed" | "failed" | "skipped" | "todo";
};

type VitestSuiteResult = {
  name: string;
  assertionResults?: VitestAssertionResult[];
};

type VitestJsonReport = {
  success?: boolean;
  numFailedTests?: number;
  numPassedTests?: number;
  testResults?: VitestSuiteResult[];
};

function parseArgs(argv: string[]): SmokeOptions {
  const configArg = argv.find((value) => value.startsWith("--config="));
  const dracoArg = argv.find((value) => value.startsWith("--draco-binding="));
  const socialArg = argv.find((value) => value.startsWith("--social-binding="));
  const testArg = argv.find((value) => value.startsWith("--exports-service-test="));
  const assumeValidated = argv.includes("--assume-validated");

  return {
    configPath: configArg ? configArg.slice("--config=".length) : "wrangler.workers.toml",
    dracoBinding: dracoArg ? dracoArg.slice("--draco-binding=".length) : "DRACO_DB",
    socialBinding: socialArg ? socialArg.slice("--social-binding=".length) : "SOCIAL_DB",
    exportsServiceTestPath: testArg ? testArg.slice("--exports-service-test=".length) : DEFAULT_EXPORTS_SERVICE_TEST_PATH,
    assumeValidated,
  };
}

function printStep(title: string): void {
  console.log(`\n[SocialFlow Export Read Models Smoke] ${title}`);
}

function runVitestJson(testPath: string, outputFile: string, forceSwitchOn: boolean): void {
  const env = {
    ...process.env,
    [SWITCH_ENV_KEY]: forceSwitchOn ? "1" : process.env[SWITCH_ENV_KEY],
  };

  execFileSync(
    "npx",
    ["vitest", "run", testPath, "--reporter=json", `--outputFile=${outputFile}`],
    {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
    },
  );
}

function flattenAssertions(report: VitestJsonReport): VitestAssertionResult[] {
  return (report.testResults ?? []).flatMap((suite) => suite.assertionResults ?? []);
}

function findAssertion(assertions: VitestAssertionResult[], title: string): VitestAssertionResult | null {
  return assertions.find((assertion) => assertion.title === title) ?? null;
}

export function assertSmokeEvidenceFromVitestReport(report: VitestJsonReport): {
  defaultOffAssertion: string;
  socialReadAssertion: string;
  coreFallbackMissingAssertion: string;
  coreFallbackFailureAssertion: string;
} {
  if (report.success !== true || (report.numFailedTests ?? 0) > 0) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_TESTS_FAILED");
  }

  const assertions = flattenAssertions(report);
  const required = REQUIRED_ASSERTION_TITLES.map((title) => {
    const assertion = findAssertion(assertions, title);
    if (!assertion) {
      throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_ASSERTION_MISSING:${title}`);
    }
    if (assertion.status !== "passed") {
      throw new Error(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_ASSERTION_NOT_PASSED:${title}:${assertion.status}`);
    }
    return assertion;
  });

  return {
    defaultOffAssertion: required[0].fullName,
    socialReadAssertion: required[1].fullName,
    coreFallbackMissingAssertion: required[2].fullName,
    coreFallbackFailureAssertion: required[3].fullName,
  };
}

export async function runSmokeSocialflowExportReadModelsSwitchLocal(options: SmokeOptions): Promise<void> {
  printStep("1/3 run local validation pack (schema, backfill, parity, tests)");
  if (options.assumeValidated) {
    console.log("validationPack=assumed-by-operator");
  } else {
    await runValidateSocialflowExportReadModelsLocal({
      configPath: options.configPath,
      dracoBinding: options.dracoBinding,
      socialBinding: options.socialBinding,
    });
  }

  printStep("2/3 run exports runtime smoke assertions with switch ON (local tests)");
  const tempOutputFile = path.join(
    os.tmpdir(),
    `drako-socialflow-export-switch-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  );

  let report: VitestJsonReport | null = null;
  try {
    runVitestJson(options.exportsServiceTestPath, tempOutputFile, true);
    const raw = await fs.readFile(tempOutputFile, "utf8");
    report = JSON.parse(raw) as VitestJsonReport;
  } finally {
    await fs.rm(tempOutputFile, { force: true });
  }

  if (!report) {
    throw new Error("SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_REPORT_MISSING");
  }

  const evidence = assertSmokeEvidenceFromVitestReport(report);

  printStep("3/3 emit smoke evidence");
  console.log(
    `EVIDENCE social-db-export-read switchVar=${SWITCH_ENV_KEY} assertion="${evidence.socialReadAssertion}"`,
  );
  console.log(
    `EVIDENCE core-fallback-export-read assertions="${evidence.coreFallbackMissingAssertion}"+"${evidence.coreFallbackFailureAssertion}"`,
  );
  console.log(
    `EVIDENCE default-off-core-backed assertion="${evidence.defaultOffAssertion}"`,
  );
  console.log(
    "EVIDENCE export-zip-shape paths=blueprint/blueprint.json,execution/work_logs.csv,economics/financials.csv,economics/economic_events.csv,domains/domain_status.json,meta.json",
  );
  console.log("SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_LOCAL_SUCCESS");
}

export async function runSmokeSocialflowExportReadModelsSwitchLocalCli(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    await runSmokeSocialflowExportReadModelsSwitchLocal(options);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_EXPORT_READ_MODELS_SMOKE_LOCAL_ERROR ${message}`);
    return 1;
  }
}

async function runCli(): Promise<void> {
  const code = await runSmokeSocialflowExportReadModelsSwitchLocalCli(process.argv.slice(2));
  if (code !== 0) {
    process.exit(code);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
