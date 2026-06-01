interface CheckSocialflowProductionManualConfigOptions {
  json?: boolean;
  markdown?: boolean;
  silent?: boolean;
}

type ManualConfigStatus =
  | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW"
  | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_TOKEN_LEAKAGE_BLOCKER";

type PresenceStatus = "PRESENT" | "MISSING";
type RedactionStatus = "REDACTED" | "MISSING";

interface ManualConfigVariableReport {
  key: string;
  required: true;
  presence: PresenceStatus;
  value: RedactionStatus;
}

interface CheckSocialflowProductionManualConfigReport {
  ok: boolean;
  status: ManualConfigStatus;
  timestamp: string;
  manualConfigurationComplete: boolean;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  requiresHumanApproval: true;
  variables: ManualConfigVariableReport[];
  missingVariables: string[];
  tokenLeakageDetected: boolean;
  remoteWrites: 0;
  productionTouched: false;
  blockers: string[];
  nextAction: string;
}

const REQUIRED_ENV_KEYS = [
  "SOCIALFLOW_PRODUCTION_BASE_URL",
  "SOCIALFLOW_PRODUCTION_HEALTH_PATH",
  "SOCIALFLOW_PRODUCTION_READINESS_PATH",
  "SOCIALFLOW_PRODUCTION_EXPECTED_HOST",
  "SOCIALFLOW_PRODUCTION_APPROVAL_ID",
  "SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID",
  "SOCIALFLOW_PRODUCTION_ON_CALL_OWNER",
  "SOCIALFLOW_PRODUCTION_WINDOW_ID",
  "SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID",
  "SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID",
  "SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID",
] as const;

const INVALID_PLACEHOLDER_PATTERNS = [
  /^required_manual_configuration$/i,
  /^todo$/i,
  /^tbd$/i,
  /^pending$/i,
  /^changeme$/i,
] as const;

const TOKEN_LEAKAGE_PATTERNS = [
  /\b(access|refresh)_token\b/i,
  /\bauthorization\s*:\s*bearer\b/i,
  /\bset-cookie\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
] as const;

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }
  return !INVALID_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function detectTokenLeakage(value: string): boolean {
  return TOKEN_LEAKAGE_PATTERNS.some((pattern) => pattern.test(value));
}

function printNormal(report: CheckSocialflowProductionManualConfigReport): void {
  console.log("\nSOCIALFLOW PRODUCTION MANUAL CONFIG CHECK");
  console.log(`Status: ${report.status}`);
  console.log(`Manual Configuration Complete: ${report.manualConfigurationComplete ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Execution Allowed: ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`Token Leakage Detected: ${report.tokenLeakageDetected ? "YES" : "NO"}\n`);

  console.log("VARIABLE CHECKS (VALUES REDACTED)");
  for (const entry of report.variables) {
    console.log(`- ${entry.key}: ${entry.presence} (${entry.value})`);
  }
  console.log();

  console.log(
    `Missing Variables: ${report.missingVariables.length === 0 ? "none" : report.missingVariables.join(", ")}`,
  );
  console.log(`Blockers: ${report.blockers.length === 0 ? "none" : report.blockers.join(", ")}`);
  console.log(`Next Action: ${report.nextAction}\n`);
  console.log(report.status);
}

function printMarkdown(report: CheckSocialflowProductionManualConfigReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION MANUAL CONFIG CHECK\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Manual Configuration Complete:** ${report.manualConfigurationComplete ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Execution Allowed:** ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`**Token Leakage Detected:** ${report.tokenLeakageDetected ? "YES" : "NO"}\n`);

  console.log("## Variable Checks (Values Redacted)\n");
  for (const entry of report.variables) {
    console.log(`- \`${entry.key}\`: ${entry.presence} (${entry.value})`);
  }
  console.log();

  console.log("## Blockers\n");
  if (report.blockers.length === 0) {
    console.log("- none");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`**Missing Variables:** ${report.missingVariables.length === 0 ? "none" : report.missingVariables.join(", ")}`);
  console.log(`**Next Action:** ${report.nextAction}\n`);
  console.log(report.status);
}

export async function checkSocialflowProductionManualConfig(
  options: CheckSocialflowProductionManualConfigOptions = {},
): Promise<CheckSocialflowProductionManualConfigReport> {
  const timestamp = new Date().toISOString();
  const variables: ManualConfigVariableReport[] = [];
  const missingVariables: string[] = [];
  const blockers = new Set<string>();
  let tokenLeakageDetected = false;

  for (const key of REQUIRED_ENV_KEYS) {
    const value = process.env[key];
    const present = isConfiguredValue(value);
    if (value && detectTokenLeakage(value)) {
      tokenLeakageDetected = true;
    }

    variables.push({
      key,
      required: true,
      presence: present ? "PRESENT" : "MISSING",
      value: present ? "REDACTED" : "MISSING",
    });

    if (!present) {
      missingVariables.push(key);
    }
  }

  if (missingVariables.length > 0) {
    blockers.add("MANUAL_CONFIGURATION_VARIABLES_MISSING");
  }
  if (tokenLeakageDetected) {
    blockers.add("TOKEN_LEAKAGE_DETECTED");
  }

  const manualConfigurationComplete = missingVariables.length === 0;
  const status: ManualConfigStatus = tokenLeakageDetected
    ? "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_TOKEN_LEAKAGE_BLOCKER"
    : manualConfigurationComplete
    ? "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW"
    : "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_BLOCKED";

  const report: CheckSocialflowProductionManualConfigReport = {
    ok: status === "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW",
    status,
    timestamp,
    manualConfigurationComplete,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    requiresHumanApproval: true,
    variables,
    missingVariables,
    tokenLeakageDetected,
    remoteWrites: 0,
    productionTouched: false,
    blockers: Array.from(blockers),
    nextAction: manualConfigurationComplete && !tokenLeakageDetected
      ? "SUBMIT_MANUAL_CONFIGURATION_FOR_HUMAN_REVIEW"
      : tokenLeakageDetected
      ? "REMOVE_SENSITIVE_VALUES_AND_RETRY"
      : "PROVIDE_MISSING_MANUAL_CONFIGURATION_VALUES",
  };

  if (!options.silent) {
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
      console.log(`\n${report.status}`);
    } else if (options.markdown) {
      printMarkdown(report);
    } else {
      printNormal(report);
    }
  }

  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const markdown = args.includes("--markdown");

  checkSocialflowProductionManualConfig({ json, markdown })
    .then((report) => {
      const shouldFail =
        report.status === "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_BLOCKED"
        || report.status === "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_TOKEN_LEAKAGE_BLOCKER";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_ERROR", error);
      process.exit(1);
    });
}
