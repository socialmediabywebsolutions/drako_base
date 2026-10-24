import {
  loadSocialflowPlannedApprovalFixture,
  resolvePlannedApprovalField,
} from "./lib/socialflow-production-planned-approval-fixture";

interface CheckSocialflowProductionManualConfigOptions {
  json?: boolean;
  markdown?: boolean;
  silent?: boolean;
  fixture?: string;
}

type ManualConfigStatus =
  | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_READY_FOR_REVIEW"
  | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_MANUAL_CONFIG_TOKEN_LEAKAGE_BLOCKER";

type PresenceStatus = "PRESENT" | "MISSING" | "FIXTURE";
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
  fixtureMode: boolean;
  productionTouchAllowed: false;
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

const TOKEN_LEAKAGE_PATTERNS = [
  /\b(access|refresh)_token\b/i,
  /\bauthorization\s*:\s*bearer\b/i,
  /\bset-cookie\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
] as const;

function detectTokenLeakage(value: string): boolean {
  return TOKEN_LEAKAGE_PATTERNS.some((pattern) => pattern.test(value));
}

function printNormal(report: CheckSocialflowProductionManualConfigReport): void {
  console.log("\nSOCIALFLOW PRODUCTION MANUAL CONFIG CHECK");
  console.log(`Status: ${report.status}`);
  console.log(`Fixture Mode: ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`Production Touch Allowed: ${report.productionTouchAllowed ? "YES" : "NO"}`);
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
  console.log(`**Fixture Mode:** ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`**Production Touch Allowed:** ${report.productionTouchAllowed ? "YES" : "NO"}`);
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
  const fixtureResolution = loadSocialflowPlannedApprovalFixture(options.fixture);
  const fixture = fixtureResolution.fixture;
  const fixtureValues: Record<string, string | undefined> | null = fixture
    ? {
        SOCIALFLOW_PRODUCTION_BASE_URL: fixture.productionBaseUrl,
        SOCIALFLOW_PRODUCTION_HEALTH_PATH: fixture.healthPath,
        SOCIALFLOW_PRODUCTION_READINESS_PATH: fixture.readinessPath,
        SOCIALFLOW_PRODUCTION_EXPECTED_HOST: fixture.expectedHost,
        SOCIALFLOW_PRODUCTION_APPROVAL_ID: fixture.approvalId,
        SOCIALFLOW_PRODUCTION_ROLLBACK_PLAN_ID: fixture.rollbackPlanId,
        SOCIALFLOW_PRODUCTION_ON_CALL_OWNER: fixture.onCallOwner,
        SOCIALFLOW_PRODUCTION_WINDOW_ID: fixture.productionWindowId,
        SOCIALFLOW_PRODUCTION_MONITORING_PLAN_ID: fixture.monitoringPlanId,
        SOCIALFLOW_PRODUCTION_SMOKE_SEQUENCE_ID: fixture.smokeSequenceId,
        SOCIALFLOW_PRODUCTION_ABORT_CRITERIA_ID: fixture.abortCriteriaId,
      }
    : null;

  for (const key of REQUIRED_ENV_KEYS) {
    const resolved = resolvePlannedApprovalField(
      process.env[key],
      fixtureValues?.[key],
      fixtureResolution.fixtureMode,
    );
    const rawValue = fixtureResolution.fixtureMode ? fixtureValues?.[key] : process.env[key];
    if (rawValue && detectTokenLeakage(rawValue)) {
      tokenLeakageDetected = true;
    }

    variables.push({
      key,
      required: true,
      presence: resolved.presence,
      value: resolved.value,
    });

    if (resolved.value === "MISSING") {
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
    fixtureMode: fixtureResolution.fixtureMode,
    productionTouchAllowed: false,
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
  const fixtureIndex = args.findIndex((arg) => arg === "--fixture" || arg.startsWith("--fixture="));
  const fixture =
    fixtureIndex >= 0
      ? args[fixtureIndex] === "--fixture"
        ? args[fixtureIndex + 1]
        : args[fixtureIndex].slice("--fixture=".length)
      : undefined;

  checkSocialflowProductionManualConfig({ json, markdown, fixture })
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
