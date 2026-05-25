import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_D1_BINDINGS = ["DRACO_DB", "SAASES_DB", "SOCIAL_DB", "SOCIALFLOW_AUTHS_DB"] as const;

const REQUIRED_OFF_SWITCHES = [
  "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
  "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
] as const;

const KNOWN_PRODUCTIVE_DATABASE_IDS = new Set([
  "5607a76a-97c7-45a9-a948-e545ba27eae7",
  "6aa6dbaf-9e35-4715-b154-cda8aee0bd54",
  "f6f46e6a-487f-400a-a2d1-c6d23e88f9cf",
]);

type D1Binding = {
  binding: string;
  databaseName: string;
  databaseId: string;
};

export type SocialflowNonprodCanaryConfigReport = {
  configPath: string;
  workerName: string | null;
  bindings: D1Binding[];
  switches: Record<string, string | undefined>;
  placeholders: string[];
  deployable: boolean;
};

type CheckOptions = {
  configPath: string;
};

function parseStringAssignment(source: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*"([^"]*)"`, "m"));
  return match?.[1] ?? null;
}

function parseD1Bindings(source: string): D1Binding[] {
  return source
    .split(/\[\[d1_databases\]\]/g)
    .slice(1)
    .map((section) => ({
      binding: parseStringAssignment(section, "binding") ?? "",
      databaseName: parseStringAssignment(section, "database_name") ?? "",
      databaseId: parseStringAssignment(section, "database_id") ?? "",
    }))
    .filter((binding) => binding.binding);
}

function isTruthy(value: string | null | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").trim().toLowerCase());
}

function isPlaceholderDatabaseId(databaseId: string): boolean {
  return databaseId.startsWith("00000000-0000-4000-8000-");
}

function hasProductiveToken(value: string): boolean {
  return /(^|[_\-\s])prod($|[_\-\s])/i.test(value);
}

function assertNonprodConfig(report: SocialflowNonprodCanaryConfigReport): void {
  const workerName = report.workerName ?? "";
  if (hasProductiveToken(workerName)) {
    throw new Error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_WORKER_NAME:${workerName}`);
  }

  for (const binding of REQUIRED_D1_BINDINGS) {
    if (!report.bindings.some((candidate) => candidate.binding === binding)) {
      throw new Error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_BINDING_MISSING:${binding}`);
    }
  }

  for (const binding of report.bindings) {
    if (hasProductiveToken(binding.databaseName)) {
      throw new Error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_DATABASE:${binding.binding}:${binding.databaseName}`);
    }

    if (KNOWN_PRODUCTIVE_DATABASE_IDS.has(binding.databaseId)) {
      throw new Error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_DATABASE_ID:${binding.binding}:${binding.databaseId}`);
    }
  }

  for (const switchName of REQUIRED_OFF_SWITCHES) {
    const value = report.switches[switchName];
    if (value !== "0") {
      throw new Error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_SWITCH_NOT_OFF:${switchName}:${value ?? "missing"}`);
    }
  }

  if (report.deployable) {
    throw new Error("SOCIALFLOW_NONPROD_CANARY_CONFIG_DEPLOYABLE_NOT_ALLOWED");
  }

  if (report.placeholders.length > 0 && report.deployable) {
    throw new Error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_PLACEHOLDER_DEPLOYABLE:${report.placeholders.join(",")}`);
  }

  if (report.switches.SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE !== "all-switches-off") {
    throw new Error("SOCIALFLOW_NONPROD_CANARY_CONFIG_ROLLBACK_STATE_MISSING");
  }
}

export function checkSocialflowNonprodCanaryConfig(options: CheckOptions): SocialflowNonprodCanaryConfigReport {
  const configPath = path.resolve(process.cwd(), options.configPath);
  if (!existsSync(configPath)) {
    throw new Error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_MISSING:${options.configPath}`);
  }

  const source = readFileSync(configPath, "utf8");
  const bindings = parseD1Bindings(source);
  const switches: Record<string, string | undefined> = {};

  for (const switchName of [...REQUIRED_OFF_SWITCHES, "SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE"]) {
    switches[switchName] = parseStringAssignment(source, switchName) ?? undefined;
  }

  const deployableValue = parseStringAssignment(source, "SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE");
  const report: SocialflowNonprodCanaryConfigReport = {
    configPath: options.configPath,
    workerName: parseStringAssignment(source, "name"),
    bindings,
    switches,
    placeholders: bindings.filter((binding) => isPlaceholderDatabaseId(binding.databaseId)).map((binding) => binding.binding),
    deployable: isTruthy(deployableValue),
  };

  assertNonprodConfig(report);
  return report;
}

function parseArgs(argv: string[]): CheckOptions[] {
  const configArgs = argv.filter((value) => value.startsWith("--config="));
  const configPaths = configArgs.length > 0
    ? configArgs.map((value) => value.slice("--config=".length))
    : ["apps/socialflow-runtime/wrangler.toml", "workers/socialflows-runtime-canary/wrangler.workers.toml"];

  return configPaths.map((configPath) => ({ configPath }));
}

export function runCheckSocialflowNonprodCanaryConfigCli(argv: string[]): number {
  try {
    const reports = parseArgs(argv).map((options) => checkSocialflowNonprodCanaryConfig(options));
    console.log(JSON.stringify({ ok: true, reports }, null, 2));
    console.log("SOCIALFLOW_NONPROD_CANARY_CONFIG_CHECK_SUCCESS");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`SOCIALFLOW_NONPROD_CANARY_CONFIG_CHECK_ERROR ${message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  const exitCode = runCheckSocialflowNonprodCanaryConfigCli(process.argv.slice(2));
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
