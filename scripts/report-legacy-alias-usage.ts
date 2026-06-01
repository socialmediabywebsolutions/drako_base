import fs from "node:fs";
import path from "node:path";
import {
  summarizeLegacyAliasUsage,
  type LegacyAliasCutCriteriaInput,
  type LegacyAliasType,
  type LegacyAliasUsageSummary,
} from "@/lib/observability/legacy-alias-usage";

type OutputMode = "summary" | "json" | "markdown";

export type LegacyAliasUsageReportStatus =
  | "LEGACY_ALIAS_USAGE_REPORT_OK"
  | "LEGACY_ALIAS_USAGE_REPORT_NO_DATA"
  | "LEGACY_ALIAS_USAGE_REPORT_BLOCKED";

export type LegacyAliasUsageReport = {
  status: LegacyAliasUsageReportStatus;
  generatedAt: string;
  summary: LegacyAliasUsageSummary;
  readyForCutCriteria: string[];
  notReadyForCutCriteria: string[];
  decision: {
    readyForCut: boolean;
    requiresHumanApproval: true;
  };
};

export type LegacyAliasUsageReportOptions = {
  mode: OutputMode;
  inputPath?: string;
  observationWindowDays?: number;
  criteriaByAlias?: Partial<Record<LegacyAliasType, LegacyAliasCutCriteriaInput>>;
  now?: string;
  rawEvents?: unknown[];
};

const READY_FOR_CUT_CRITERIA = [
  "totalHits=0 during approved observation window OR callers migrated",
  "canonicalTarget exists",
  "rollback path exists",
  "monitoring active",
  "observation window complete",
  "human approval recorded",
  "no blockers",
];

const NOT_READY_FOR_CUT_CRITERIA = [
  "recent hits exist",
  "unknown source activity is relevant",
  "canonicalTarget missing",
  "rollback path missing",
  "human approval missing",
  "observation window incomplete",
  "monitoring inactive",
];

type CliArgs = {
  mode: OutputMode;
  inputPath?: string;
};

export function resolveCliArgs(argv: string[]): CliArgs {
  const mode: OutputMode = argv.includes("--json") ? "json" : argv.includes("--markdown") ? "markdown" : "summary";
  const inputFlagIndex = argv.findIndex((value) => value === "--input");
  const inputPath = inputFlagIndex >= 0 ? argv[inputFlagIndex + 1] : undefined;
  return { mode, inputPath };
}

function normalizeEventArrayCandidate(candidate: unknown): unknown[] {
  if (Array.isArray(candidate)) return candidate;
  return [];
}

export function parseLegacyAliasTelemetrySource(rawSource: string): unknown[] {
  const trimmed = rawSource.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const objectCandidate = parsed as Record<string, unknown>;
      const events = normalizeEventArrayCandidate(objectCandidate.events);
      if (events.length > 0) return events;
      const data = normalizeEventArrayCandidate(objectCandidate.data);
      if (data.length > 0) return data;
      return [objectCandidate];
    }
  } catch {
    // Continue with line parser.
  }

  const events: unknown[] = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const current = line.trim();
    if (!current) continue;

    const jsonLike = current.startsWith("LEGACY_COMPAT_ROUTE_HIT")
      ? current.slice("LEGACY_COMPAT_ROUTE_HIT".length).trim()
      : current;
    if (!jsonLike || !jsonLike.startsWith("{")) continue;

    try {
      events.push(JSON.parse(jsonLike));
    } catch {
      // Ignore malformed lines in read-only report mode.
    }
  }
  return events;
}

function resolveInputPath(inputPath: string | undefined): string | null {
  const fromCli = inputPath?.trim();
  if (fromCli) return path.resolve(process.cwd(), fromCli);
  const fromEnv = process.env.LEGACY_ALIAS_USAGE_INPUT?.trim();
  if (fromEnv) return path.resolve(process.cwd(), fromEnv);
  return null;
}

export function loadLegacyAliasUsageEvents(options: LegacyAliasUsageReportOptions): unknown[] {
  if (options.rawEvents) return options.rawEvents;

  const filePath = resolveInputPath(options.inputPath);
  if (!filePath) return [];
  if (!fs.existsSync(filePath)) return [];

  const source = fs.readFileSync(filePath, "utf8");
  return parseLegacyAliasTelemetrySource(source);
}

function buildDefaultCriteria(
  criteriaByAlias: LegacyAliasUsageReportOptions["criteriaByAlias"],
): Partial<Record<LegacyAliasType, LegacyAliasCutCriteriaInput>> {
  const base: LegacyAliasCutCriteriaInput = {
    canonicalTargetExists: true,
    rollbackPathExists: false,
    monitoringActive: false,
    callersMigrated: false,
    humanApprovalRecorded: false,
    observationWindowComplete: false,
  };

  return {
    owner: { ...base, ...criteriaByAlias?.owner },
    campobase: { ...base, ...criteriaByAlias?.campobase },
  };
}

export function buildLegacyAliasUsageReport(options: LegacyAliasUsageReportOptions): LegacyAliasUsageReport {
  const rawEvents = loadLegacyAliasUsageEvents(options);
  const summary = summarizeLegacyAliasUsage({
    events: rawEvents,
    now: options.now,
    observationWindowDays: options.observationWindowDays,
    criteriaByAlias: buildDefaultCriteria(options.criteriaByAlias),
  });

  let status: LegacyAliasUsageReportStatus;
  if (summary.totalHits === 0) {
    status = "LEGACY_ALIAS_USAGE_REPORT_NO_DATA";
  } else if (summary.readyForCut) {
    status = "LEGACY_ALIAS_USAGE_REPORT_OK";
  } else {
    status = "LEGACY_ALIAS_USAGE_REPORT_BLOCKED";
  }

  return {
    status,
    generatedAt: new Date().toISOString(),
    summary,
    readyForCutCriteria: READY_FOR_CUT_CRITERIA,
    notReadyForCutCriteria: NOT_READY_FOR_CUT_CRITERIA,
    decision: {
      readyForCut: summary.readyForCut,
      requiresHumanApproval: true,
    },
  };
}

function toSummaryOutput(report: LegacyAliasUsageReport): string {
  const lines = [
    report.status,
    `generatedAt=${report.generatedAt}`,
    `totalHits=${report.summary.totalHits}`,
    `hits.owner=${report.summary.hitsByAliasType.owner}`,
    `hits.campobase=${report.summary.hitsByAliasType.campobase}`,
    `lastSeenAt=${report.summary.lastSeenAt ?? "none"}`,
    `uniqueSourcesApprox=${report.summary.uniqueSourcesApprox}`,
    `sensitiveDataRedactedCount=${report.summary.sensitiveDataRedactedCount}`,
    `unknownSourceCount=${report.summary.unknownSourceCount}`,
    `readyForCut=${report.summary.readyForCut}`,
    `requiresHumanApproval=${report.summary.requiresHumanApproval}`,
    `candidateForCut=${report.summary.candidateForCut}`,
    `blockers=${report.summary.blockers.join(",") || "none"}`,
  ];
  return `${lines.join("\n")}\n`;
}

function toMarkdownOutput(report: LegacyAliasUsageReport): string {
  const lines = [
    "# Legacy Alias Usage Report",
    "",
    `**Status:** ${report.status}`,
    `**Generated At:** ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    `- totalHits: ${report.summary.totalHits}`,
    `- hitsByAliasType.owner: ${report.summary.hitsByAliasType.owner}`,
    `- hitsByAliasType.campobase: ${report.summary.hitsByAliasType.campobase}`,
    `- lastSeenAt: ${report.summary.lastSeenAt ?? "none"}`,
    `- uniqueSourcesApprox: ${report.summary.uniqueSourcesApprox}`,
    `- sensitiveDataRedactedCount: ${report.summary.sensitiveDataRedactedCount}`,
    `- unknownSourceCount: ${report.summary.unknownSourceCount}`,
    `- readyForCut: ${report.summary.readyForCut}`,
    `- requiresHumanApproval: ${report.summary.requiresHumanApproval}`,
    "",
    "## Alias Decisions",
    "",
    `- owner.readyForCut: ${report.summary.byAlias.owner.readyForCut}`,
    `- owner.blockers: ${report.summary.byAlias.owner.blockers.join(",") || "none"}`,
    `- campobase.readyForCut: ${report.summary.byAlias.campobase.readyForCut}`,
    `- campobase.blockers: ${report.summary.byAlias.campobase.blockers.join(",") || "none"}`,
    "",
    "## READY_FOR_CUT Criteria",
    "",
    ...report.readyForCutCriteria.map((criterion) => `- ${criterion}`),
    "",
    "## NOT_READY_FOR_CUT Criteria",
    "",
    ...report.notReadyForCutCriteria.map((criterion) => `- ${criterion}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

export function renderLegacyAliasUsageReport(report: LegacyAliasUsageReport, mode: OutputMode): string {
  if (mode === "json") return `${JSON.stringify(report, null, 2)}\n`;
  if (mode === "markdown") return toMarkdownOutput(report);
  return toSummaryOutput(report);
}

export function runLegacyAliasUsageReportCli(argv: string[]): number {
  try {
    const cliArgs = resolveCliArgs(argv);
    const report = buildLegacyAliasUsageReport({
      mode: cliArgs.mode,
      inputPath: cliArgs.inputPath,
    });
    const output = renderLegacyAliasUsageReport(report, cliArgs.mode);
    process.stdout.write(output);
    return 0;
  } catch (error) {
    console.error("LEGACY_ALIAS_USAGE_REPORT_FAILED", error);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runLegacyAliasUsageReportCli(process.argv.slice(2));
  process.exit(exitCode);
}
