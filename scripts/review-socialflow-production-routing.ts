import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  loadSocialflowPlannedApprovalFixture,
  resolvePlannedApprovalField,
} from "./lib/socialflow-production-planned-approval-fixture";

interface RoutingReviewOptions {
  json?: boolean;
  markdown?: boolean;
  silent?: boolean;
  fixture?: string;
}

type RoutingReviewStatus =
  | "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_BLOCKED"
  | "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING"
  | "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_TOKEN_LEAKAGE_BLOCKER";

type PresenceStatus = "PRESENT" | "MISSING" | "FIXTURE";
type RedactionStatus = "REDACTED" | "MISSING";

interface RoutingReviewFieldReport {
  key: string;
  required: true;
  presence: PresenceStatus;
  value: RedactionStatus;
}

interface RoutingReviewReport {
  ok: boolean;
  status: RoutingReviewStatus;
  timestamp: string;
  fixtureMode: boolean;
  productionTouchAllowed: false;
  readyForExecution: false;
  executionAllowed: false;
  commandsArePlannedOnly: true;
  requiresHumanApproval: true;
  manualConfigurationRequired: true;
  dnsRoutingRequired: true;
  routingReviewScriptPresent: boolean;
  routingReviewPackPresent: boolean;
  targets: {
    productionBaseUrl: RoutingReviewFieldReport;
    expectedHost: RoutingReviewFieldReport;
    healthPath: RoutingReviewFieldReport;
    readinessPath: RoutingReviewFieldReport;
    workerTarget: string;
  };
  wranglerProductionTemplate: {
    path: string;
    present: boolean;
    workerEntry: string | null;
    workersDevFalse: boolean;
    routesCommentedOnly: boolean;
    plannedOnlyRouteCommentsPresent: boolean;
    status: "PRESENT" | "MISSING";
  };
  checklist: {
    dnsRecordsExpected: string[];
    cloudflareRoutesExpected: string[];
    rollbackRoutingChecklist: string[];
  };
  blockers: string[];
  recommendation: string;
  nextAction: string;
}

const ROUTING_REVIEW_PACK_PATH = "docs/architecture/socialflow-production-routing-review-pack.md";
const WRANGLER_PRODUCTION_TEMPLATE_PATH = "apps/socialflow-runtime/wrangler.production.toml";
const TOKEN_LEAKAGE_PATTERNS = [
  /\b(access|refresh)_token\b/i,
  /\bauthorization\s*:\s*bearer\b/i,
  /\bset-cookie\b/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
] as const;

function detectTokenLeakage(value: string): boolean {
  return TOKEN_LEAKAGE_PATTERNS.some((pattern) => pattern.test(value));
}

function readTemplateMetadata(templateSource: string): {
  workerEntry: string | null;
  workerTarget: string | null;
  workersDevFalse: boolean;
  routesCommentedOnly: boolean;
  plannedOnlyRouteCommentsPresent: boolean;
} {
  const workerEntryMatch = templateSource.match(/^\s*main\s*=\s*"([^"]+)"/m);
  const workerTargetMatch = templateSource.match(/^\s*name\s*=\s*"([^"]+)"/m);
  const workersDevFalse = /^\s*workers_dev\s*=\s*false\s*$/m.test(templateSource);
  const commentedRouteLines = /^\s*#\s*routes?\s*=\s*/m.test(templateSource);
  const activeRouteLines = /^\s*routes?\s*=\s*/m.test(templateSource);

  return {
    workerEntry: workerEntryMatch?.[1] ?? null,
    workerTarget: workerTargetMatch?.[1] ?? null,
    workersDevFalse,
    routesCommentedOnly: commentedRouteLines && !activeRouteLines,
    plannedOnlyRouteCommentsPresent: commentedRouteLines,
  };
}

function buildFieldReport(
  key: string,
  envValue: string | undefined,
  fixtureValue: string | undefined,
  fixtureMode: boolean,
): RoutingReviewFieldReport {
  const resolved = resolvePlannedApprovalField(envValue, fixtureValue, fixtureMode);

  return {
    key,
    required: true,
    presence: resolved.presence,
    value: resolved.value,
  };
}

function safeDisplayValue(value: string | null | undefined, fixtureMode: boolean): string {
  if (!value) {
    return "[MISSING]";
  }

  if (fixtureMode && value.endsWith(".invalid")) {
    return value;
  }

  return "[REDACTED]";
}

function printNormal(report: RoutingReviewReport): void {
  console.log("\nSOCIALFLOW PRODUCTION ROUTING REVIEW");
  console.log(`Status: ${report.status}`);
  console.log(`Fixture Mode: ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`Production Touch Allowed: ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`Ready for Execution: ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`Execution Allowed: ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`Commands Are Planned Only: ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`Requires Human Approval: ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`Manual Configuration Required: ${report.manualConfigurationRequired ? "YES" : "NO"}`);
  console.log(`DNS Routing Required: ${report.dnsRoutingRequired ? "YES" : "NO"}`);
  console.log(`Routing Review Pack Present: ${report.routingReviewPackPresent ? "YES" : "NO"}`);
  console.log(`Routing Review Script Present: ${report.routingReviewScriptPresent ? "YES" : "NO"}\n`);

  console.log("TARGETS (VALUES REDACTED)");
  for (const target of [
    report.targets.productionBaseUrl,
    report.targets.expectedHost,
    report.targets.healthPath,
    report.targets.readinessPath,
  ]) {
    console.log(`- ${target.key}: ${target.presence} (${target.value})`);
  }
  console.log(`- workerTarget: ${report.targets.workerTarget}\n`);

  console.log("WRANGLER PRODUCTION TEMPLATE");
  console.log(`- Path: ${report.wranglerProductionTemplate.path}`);
  console.log(`- Present: ${report.wranglerProductionTemplate.present ? "YES" : "NO"}`);
  console.log(`- workerEntry: ${report.wranglerProductionTemplate.workerEntry ?? "[MISSING]"}`);
  console.log(`- workers_dev=false: ${report.wranglerProductionTemplate.workersDevFalse ? "YES" : "NO"}`);
  console.log(
    `- routes commented only: ${report.wranglerProductionTemplate.routesCommentedOnly ? "YES" : "NO"}`,
  );
  console.log(
    `- planned-only route comments present: ${report.wranglerProductionTemplate.plannedOnlyRouteCommentsPresent ? "YES" : "NO"}\n`,
  );

  console.log("CHECKLIST");
  report.checklist.dnsRecordsExpected.forEach((item) => console.log(`- DNS: ${item}`));
  report.checklist.cloudflareRoutesExpected.forEach((item) => console.log(`- Route: ${item}`));
  report.checklist.rollbackRoutingChecklist.forEach((item) => console.log(`- Rollback: ${item}`));
  console.log();

  console.log("BLOCKERS");
  if (report.blockers.length === 0) {
    console.log("None");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`Recommendation: ${report.recommendation}`);
  console.log(`Next Action: ${report.nextAction}`);
  console.log(report.status);
}

function printMarkdown(report: RoutingReviewReport): void {
  console.log("\n# SOCIALFLOW PRODUCTION ROUTING REVIEW\n");
  console.log(`**Status:** ${report.status}`);
  console.log(`**Fixture Mode:** ${report.fixtureMode ? "YES" : "NO"}`);
  console.log(`**Production Touch Allowed:** ${report.productionTouchAllowed ? "YES" : "NO"}`);
  console.log(`**Ready for Execution:** ${report.readyForExecution ? "YES" : "NO"}`);
  console.log(`**Execution Allowed:** ${report.executionAllowed ? "YES" : "NO"}`);
  console.log(`**Commands Are Planned Only:** ${report.commandsArePlannedOnly ? "YES" : "NO"}`);
  console.log(`**Requires Human Approval:** ${report.requiresHumanApproval ? "YES" : "NO"}`);
  console.log(`**Manual Configuration Required:** ${report.manualConfigurationRequired ? "YES" : "NO"}`);
  console.log(`**DNS Routing Required:** ${report.dnsRoutingRequired ? "YES" : "NO"}`);
  console.log(`**Routing Review Pack Present:** ${report.routingReviewPackPresent ? "YES" : "NO"}`);
  console.log(`**Routing Review Script Present:** ${report.routingReviewScriptPresent ? "YES" : "NO"}\n`);

  console.log("## Targets (Values Redacted)\n");
  for (const target of [
    report.targets.productionBaseUrl,
    report.targets.expectedHost,
    report.targets.healthPath,
    report.targets.readinessPath,
  ]) {
    console.log(`- \`${target.key}\`: ${target.presence} (${target.value})`);
  }
  console.log(`- \`workerTarget\`: ${report.targets.workerTarget}\n`);

  console.log("## Wrangler Production Template\n");
  console.log(`- Path: \`${report.wranglerProductionTemplate.path}\``);
  console.log(`- Present: ${report.wranglerProductionTemplate.present ? "YES" : "NO"}`);
  console.log(`- workerEntry: \`${report.wranglerProductionTemplate.workerEntry ?? "[MISSING]"}\``);
  console.log(`- workers_dev=false: ${report.wranglerProductionTemplate.workersDevFalse ? "YES" : "NO"}`);
  console.log(`- routes commented only: ${report.wranglerProductionTemplate.routesCommentedOnly ? "YES" : "NO"}`);
  console.log(
    `- planned-only route comments present: ${report.wranglerProductionTemplate.plannedOnlyRouteCommentsPresent ? "YES" : "NO"}\n`,
  );

  console.log("## Checklist\n");
  report.checklist.dnsRecordsExpected.forEach((item) => console.log(`- DNS: ${item}`));
  report.checklist.cloudflareRoutesExpected.forEach((item) => console.log(`- Route: ${item}`));
  report.checklist.rollbackRoutingChecklist.forEach((item) => console.log(`- Rollback: ${item}`));
  console.log();

  console.log("## Blockers\n");
  if (report.blockers.length === 0) {
    console.log("- none");
  } else {
    report.blockers.forEach((blocker) => console.log(`- ${blocker}`));
  }
  console.log();

  console.log(`**Recommendation:** ${report.recommendation}`);
  console.log(`**Next Action:** ${report.nextAction}`);
  console.log(report.status);
}

export async function reviewSocialflowProductionRouting(
  options: RoutingReviewOptions = {},
): Promise<RoutingReviewReport> {
  const timestamp = new Date().toISOString();
  const blockers = new Set<string>();
  const routingReviewScriptPresent = existsSync(path.resolve(process.cwd(), "scripts", "review-socialflow-production-routing.ts"));
  const routingReviewPackPresent = existsSync(path.resolve(process.cwd(), ROUTING_REVIEW_PACK_PATH));
  const templatePath = path.resolve(process.cwd(), WRANGLER_PRODUCTION_TEMPLATE_PATH);
  const templatePresent = existsSync(templatePath);

  let fixtureMode = false;
  let productionTouchAllowed: false = false;
  let fixtureError: string | null = null;
  let fixtureErrorSensitive = false;
  let fixture = null as Awaited<ReturnType<typeof loadSocialflowPlannedApprovalFixture>>["fixture"];

  try {
    const fixtureResolution = loadSocialflowPlannedApprovalFixture(options.fixture);
    fixtureMode = fixtureResolution.fixtureMode;
    productionTouchAllowed = fixtureResolution.productionTouchAllowed;
    fixture = fixtureResolution.fixture;
  } catch (error) {
    fixtureMode = true;
    fixtureError = error instanceof Error ? error.message : String(error);
    fixtureErrorSensitive =
      /sensitive-looking content/i.test(fixtureError ?? "") || /token/i.test(fixtureError ?? "");
  }

  const envBaseUrl = process.env.SOCIALFLOW_PRODUCTION_BASE_URL;
  const envExpectedHost = process.env.SOCIALFLOW_PRODUCTION_EXPECTED_HOST;
  const envHealthPath = process.env.SOCIALFLOW_PRODUCTION_HEALTH_PATH;
  const envReadinessPath = process.env.SOCIALFLOW_PRODUCTION_READINESS_PATH;

  const fieldSource = fixture
    ? {
        SOCIALFLOW_PRODUCTION_BASE_URL: fixture.productionBaseUrl,
        SOCIALFLOW_PRODUCTION_EXPECTED_HOST: fixture.expectedHost,
        SOCIALFLOW_PRODUCTION_HEALTH_PATH: fixture.healthPath,
        SOCIALFLOW_PRODUCTION_READINESS_PATH: fixture.readinessPath,
      }
    : null;

  const fields = {
    productionBaseUrl: buildFieldReport(
      "SOCIALFLOW_PRODUCTION_BASE_URL",
      envBaseUrl,
      fieldSource?.SOCIALFLOW_PRODUCTION_BASE_URL,
      fixtureMode && Boolean(fixture),
    ),
    expectedHost: buildFieldReport(
      "SOCIALFLOW_PRODUCTION_EXPECTED_HOST",
      envExpectedHost,
      fieldSource?.SOCIALFLOW_PRODUCTION_EXPECTED_HOST,
      fixtureMode && Boolean(fixture),
    ),
    healthPath: buildFieldReport(
      "SOCIALFLOW_PRODUCTION_HEALTH_PATH",
      envHealthPath,
      fieldSource?.SOCIALFLOW_PRODUCTION_HEALTH_PATH,
      fixtureMode && Boolean(fixture),
    ),
    readinessPath: buildFieldReport(
      "SOCIALFLOW_PRODUCTION_READINESS_PATH",
      envReadinessPath,
      fieldSource?.SOCIALFLOW_PRODUCTION_READINESS_PATH,
      fixtureMode && Boolean(fixture),
    ),
  };

  const rawBaseUrl = fixture ? fixture.productionBaseUrl : envBaseUrl;
  const rawExpectedHost = fixture ? fixture.expectedHost : envExpectedHost;
  const rawHealthPath = fixture ? fixture.healthPath : envHealthPath;
  const rawReadinessPath = fixture ? fixture.readinessPath : envReadinessPath;

  const rawValues = [rawBaseUrl, rawExpectedHost, rawHealthPath, rawReadinessPath].filter(
    (value): value is string => typeof value === "string",
  );
  const tokenLeakageDetected = rawValues.some((value) => detectTokenLeakage(value));

  const templateSource = templatePresent ? readFileSync(templatePath, "utf8") : "";
  const templateMetadata = templatePresent
    ? readTemplateMetadata(templateSource)
    : {
        workerEntry: null,
        workerTarget: null,
        workersDevFalse: false,
        routesCommentedOnly: false,
        plannedOnlyRouteCommentsPresent: false,
      };

  const safeHostValue = fixtureMode && fixture ? safeDisplayValue(fixture.expectedHost, true) : "[REDACTED]";
  const safeBaseUrlValue = fixtureMode && fixture ? safeDisplayValue(fixture.productionBaseUrl, true) : "[REDACTED]";
  const safeHealthPathValue = fixtureMode && fixture ? fixture.healthPath : rawHealthPath ?? "[MISSING]";
  const safeReadinessPathValue = fixtureMode && fixture ? fixture.readinessPath : rawReadinessPath ?? "[MISSING]";
  const workerTarget = templateMetadata.workerTarget ?? "MISSING";

  if (fixtureError) {
    blockers.add("FIXTURE_VALIDATION_FAILED");
  }
  if (tokenLeakageDetected || fixtureErrorSensitive) {
    blockers.add("TOKEN_LEAKAGE_DETECTED");
  }
  if (!fixtureMode) {
    blockers.add("PLANNED_ONLY_FIXTURE_REQUIRED");
  }
  if (!fields.productionBaseUrl.presence || fields.productionBaseUrl.presence === "MISSING") {
    blockers.add("PRODUCTION_BASE_URL_MISSING");
  }
  if (!fields.expectedHost.presence || fields.expectedHost.presence === "MISSING") {
    blockers.add("EXPECTED_HOST_MISSING");
  }
  if (!fields.healthPath.presence || fields.healthPath.presence === "MISSING") {
    blockers.add("HEALTH_PATH_MISSING");
  }
  if (!fields.readinessPath.presence || fields.readinessPath.presence === "MISSING") {
    blockers.add("READINESS_PATH_MISSING");
  }
  if (!templatePresent) {
    blockers.add("WRANGLER_PRODUCTION_TEMPLATE_MISSING");
  }
  if (!templateMetadata.workersDevFalse) {
    blockers.add("WORKERS_DEV_NOT_FALSE");
  }
  if (!templateMetadata.routesCommentedOnly) {
    blockers.add("ROUTES_NOT_PLANNED_ONLY");
  }
  if (!routingReviewPackPresent) {
    blockers.add("ROUTING_REVIEW_PACK_MISSING");
  }
  if (!workerTarget || workerTarget === "MISSING") {
    blockers.add("WORKER_TARGET_MISSING");
  }

  const readyForPlanning =
    fixtureMode &&
    !fixtureError &&
    !tokenLeakageDetected &&
    templatePresent &&
    templateMetadata.workersDevFalse &&
    templateMetadata.routesCommentedOnly &&
    routingReviewPackPresent &&
    workerTarget !== "MISSING" &&
    fields.productionBaseUrl.presence !== "MISSING" &&
    fields.expectedHost.presence !== "MISSING" &&
    fields.healthPath.presence !== "MISSING" &&
    fields.readinessPath.presence !== "MISSING";

  const status: RoutingReviewStatus = tokenLeakageDetected || fixtureErrorSensitive
    ? "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_TOKEN_LEAKAGE_BLOCKER"
    : readyForPlanning
    ? "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING"
    : "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_BLOCKED";

  const dnsRecordsExpected = [
    `CNAME ${safeHostValue} -> Cloudflare Workers`,
    `Health path ${safeHealthPathValue} reviewed against ${safeBaseUrlValue}`,
    `Readiness path ${safeReadinessPathValue} reviewed against ${safeBaseUrlValue}`,
  ];

  const cloudflareRoutesExpected = [
    `Route ${safeHostValue}/* -> ${workerTarget}`,
    "Route configuration remains commented/planned-only in wrangler.production.toml",
  ];

  const rollbackRoutingChecklist = [
    "Keep current route mapping in commented/planned-only form until human approval.",
    "Abort if any active route line appears in the production template.",
    "Rollback routing only by restoring the previous approved route manifest.",
  ];

  const report: RoutingReviewReport = {
    ok: status === "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_READY_FOR_PLANNING",
    status,
    timestamp,
    fixtureMode,
    productionTouchAllowed,
    readyForExecution: false,
    executionAllowed: false,
    commandsArePlannedOnly: true,
    requiresHumanApproval: true,
    manualConfigurationRequired: true,
    dnsRoutingRequired: true,
    routingReviewScriptPresent,
    routingReviewPackPresent,
    targets: {
      productionBaseUrl: fields.productionBaseUrl,
      expectedHost: fields.expectedHost,
      healthPath: fields.healthPath,
      readinessPath: fields.readinessPath,
      workerTarget,
    },
    wranglerProductionTemplate: {
      path: WRANGLER_PRODUCTION_TEMPLATE_PATH,
      present: templatePresent,
      workerEntry: templateMetadata.workerEntry,
      workersDevFalse: templateMetadata.workersDevFalse,
      routesCommentedOnly: templateMetadata.routesCommentedOnly,
      plannedOnlyRouteCommentsPresent: templateMetadata.plannedOnlyRouteCommentsPresent,
      status: templatePresent ? "PRESENT" : "MISSING",
    },
    checklist: {
      dnsRecordsExpected,
      cloudflareRoutesExpected,
      rollbackRoutingChecklist,
    },
    blockers: Array.from(blockers),
    recommendation: readyForPlanning
      ? "ROUTING REVIEW READY FOR PLANNING - Planned-only routing evidence is present and redacted."
      : tokenLeakageDetected || fixtureErrorSensitive
      ? "ROUTING REVIEW BLOCKED - Sensitive-looking data detected; remove leakage and retry."
      : "ROUTING REVIEW BLOCKED - Use the planned-only fixture and keep DNS/route changes out of execution.",
    nextAction: readyForPlanning
      ? "SUBMIT_ROUTING_REVIEW_FOR_HUMAN_REVIEW"
      : tokenLeakageDetected || fixtureErrorSensitive
      ? "REMOVE_SENSITIVE_VALUES_AND_RETRY"
      : fixtureMode
      ? "RESOLVE_ROUTING_REVIEW_BLOCKERS"
      : "PROVIDE_PLANNED_ONLY_FIXTURE_AND_RETRY",
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

  reviewSocialflowProductionRouting({ json, markdown, fixture })
    .then((report) => {
      const shouldFail =
        report.status === "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_BLOCKED" ||
        report.status === "SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_TOKEN_LEAKAGE_BLOCKER";
      process.exit(shouldFail ? 1 : 0);
    })
    .catch((error) => {
      console.error("SOCIALFLOW_PRODUCTION_ROUTING_REVIEW_ERROR", error);
      process.exit(1);
    });
}
