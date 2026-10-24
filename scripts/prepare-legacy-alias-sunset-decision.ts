import fs from "node:fs";
import path from "node:path";
import {
  buildLegacyAliasUsageReport,
  type LegacyAliasUsageReport,
} from "./report-legacy-alias-usage";

type OutputMode = "summary" | "json" | "markdown";

export type LegacyAliasDecisionClass =
  | "KEEP_COMPAT"
  | "READY_FOR_OBSERVATION"
  | "READY_FOR_MIGRATION"
  | "READY_FOR_CUT_REQUIRES_APPROVAL"
  | "BLOCKED";

export type LegacyAliasSunsetDecisionStatus =
  | "LEGACY_ALIAS_SUNSET_DECISION_READY"
  | "LEGACY_ALIAS_SUNSET_DECISION_BLOCKED"
  | "LEGACY_ALIAS_SUNSET_DECISION_NO_DATA";

type LegacyAliasMatrixEntry = {
  routePath: string;
  filePath: string;
  canonicalTarget: string;
  status: "LEGACY_COMPAT_ACCEPTED" | "NEEDS_DEPRECATION" | "NEEDS_CUT" | "BLOCKER" | "UNKNOWN_REVIEW";
  risk?: string;
};

type LegacyAliasMatrixSnapshot = {
  summary: {
    counts: {
      ownerAliases: number;
      campobaseAliases: number;
    };
  };
  legacyAliases: {
    owner: LegacyAliasMatrixEntry[];
    campobase: LegacyAliasMatrixEntry[];
  };
};

export type LegacyAliasSunsetDecisionRow = {
  aliasType: "owner" | "campobase";
  routePath: string;
  filePath: string;
  canonicalTarget: string;
  matrixStatus: LegacyAliasMatrixEntry["status"];
  usageHitsOnPath: number;
  aliasWideUsageHits: number;
  aliasWideRecentHits: number;
  aliasWideLastSeenAt: string | null;
  blockers: string[];
  class: LegacyAliasDecisionClass;
  recommendedAction: string;
  readyForCut: boolean;
  requiresHumanApproval: true;
};

export type LegacyAliasSunsetDecisionPack = {
  status: LegacyAliasSunsetDecisionStatus;
  generatedAt: string;
  usageReportStatus: LegacyAliasUsageReport["status"];
  totals: {
    aliases: number;
    ownerAliases: number;
    campobaseAliases: number;
    byClass: Record<LegacyAliasDecisionClass, number>;
  };
  classes: Record<LegacyAliasDecisionClass, string[]>;
  requiresHumanApproval: true;
  readyForCut: boolean;
  globalDecision: string;
  blockers: string[];
  rollbackChecklist: string[];
  approvalChecklist: string[];
  rows: LegacyAliasSunsetDecisionRow[];
};

export type LegacyAliasSunsetDecisionOptions = {
  mode: OutputMode;
  matrixPath?: string;
  usageReport?: LegacyAliasUsageReport;
  matrixSnapshot?: LegacyAliasMatrixSnapshot;
};

type CliArgs = {
  mode: OutputMode;
  matrixPath?: string;
  usageInputPath?: string;
};

const DEFAULT_MATRIX_PATH = "docs/config/legacy-alias-deprecation-matrix.json";
const HARD_BLOCKERS = new Set(["CANONICAL_TARGET_MISSING", "UNKNOWN_REVIEW_STATUS", "MATRIX_BLOCKER"]);

const ROLLBACK_CHECKLIST = [
  "Confirm legacy route inventory snapshot is current.",
  "Prepare per-alias rollback toggle (restore alias re-export/proxy).",
  "Keep canonical route health checks green before/after change.",
  "Stage cut in canary window before broad rollout.",
  "Document restore command/runbook and owner on-call.",
];

const APPROVAL_CHECKLIST = [
  "Human approver assigned and recorded.",
  "Observation window evidence attached.",
  "Migration evidence for callers attached.",
  "Rollback checklist validated.",
  "Monitoring dashboard and alerts acknowledged.",
];

function readJsonFile<T>(absolutePath: string): T {
  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as T;
}

function resolveMatrixPath(inputPath: string | undefined): string {
  const requested = inputPath?.trim();
  if (requested) return path.resolve(process.cwd(), requested);
  return path.resolve(process.cwd(), DEFAULT_MATRIX_PATH);
}

function resolveCliArgs(argv: string[]): CliArgs {
  const mode: OutputMode = argv.includes("--json") ? "json" : argv.includes("--markdown") ? "markdown" : "summary";
  const matrixFlagIndex = argv.findIndex((value) => value === "--matrix");
  const usageInputFlagIndex = argv.findIndex((value) => value === "--usage-input");
  const matrixPath = matrixFlagIndex >= 0 ? argv[matrixFlagIndex + 1] : undefined;
  const usageInputPath = usageInputFlagIndex >= 0 ? argv[usageInputFlagIndex + 1] : undefined;
  return { mode, matrixPath, usageInputPath };
}

function toAliasRows(matrix: LegacyAliasMatrixSnapshot): Array<LegacyAliasMatrixEntry & { aliasType: "owner" | "campobase" }> {
  return [
    ...matrix.legacyAliases.owner.map((entry) => ({ ...entry, aliasType: "owner" as const })),
    ...matrix.legacyAliases.campobase.map((entry) => ({ ...entry, aliasType: "campobase" as const })),
  ].sort((left, right) => left.routePath.localeCompare(right.routePath));
}

function resolveRecommendedAction(decisionClass: LegacyAliasDecisionClass): string {
  switch (decisionClass) {
    case "KEEP_COMPAT":
      return "Keep compatibility route active and avoid net-new callers.";
    case "READY_FOR_OBSERVATION":
      return "Keep route active and continue collecting telemetry evidence.";
    case "READY_FOR_MIGRATION":
      return "Prioritize caller migration to canonical target before any sunset.";
    case "READY_FOR_CUT_REQUIRES_APPROVAL":
      return "Prepare manual approval packet; do not cut until approved window.";
    case "BLOCKED":
      return "Resolve blockers before migration/cut decisions.";
  }
}

function resolveDecisionClass(params: {
  usageReport: LegacyAliasUsageReport;
  matrixEntry: LegacyAliasMatrixEntry;
  aliasType: "owner" | "campobase";
  aliasWideBlockers: string[];
  pathHits: number;
}): LegacyAliasDecisionClass {
  const { usageReport, matrixEntry, aliasWideBlockers, pathHits } = params;

  if (matrixEntry.status === "BLOCKER") return "BLOCKED";
  if (!matrixEntry.canonicalTarget?.trim()) return "BLOCKED";

  if (usageReport.status === "LEGACY_ALIAS_USAGE_REPORT_NO_DATA") {
    return matrixEntry.status === "LEGACY_COMPAT_ACCEPTED" ? "KEEP_COMPAT" : "READY_FOR_OBSERVATION";
  }

  if (aliasWideBlockers.some((blocker) => HARD_BLOCKERS.has(blocker))) {
    return "BLOCKED";
  }

  if (pathHits > 0) {
    return "READY_FOR_MIGRATION";
  }

  if (usageReport.summary.byAlias[params.aliasType].readyForCut) {
    return "READY_FOR_CUT_REQUIRES_APPROVAL";
  }

  if (aliasWideBlockers.length > 0) {
    return "READY_FOR_OBSERVATION";
  }

  return matrixEntry.status === "LEGACY_COMPAT_ACCEPTED" ? "KEEP_COMPAT" : "READY_FOR_MIGRATION";
}

function createEmptyClassCounts(): Record<LegacyAliasDecisionClass, number> {
  return {
    KEEP_COMPAT: 0,
    READY_FOR_OBSERVATION: 0,
    READY_FOR_MIGRATION: 0,
    READY_FOR_CUT_REQUIRES_APPROVAL: 0,
    BLOCKED: 0,
  };
}

export function buildLegacyAliasSunsetDecisionPack(
  options: LegacyAliasSunsetDecisionOptions,
): LegacyAliasSunsetDecisionPack {
  const matrix = options.matrixSnapshot ?? readJsonFile<LegacyAliasMatrixSnapshot>(resolveMatrixPath(options.matrixPath));
  const usageReport =
    options.usageReport
    ?? buildLegacyAliasUsageReport({
      mode: "json",
    });
  const matrixRows = toAliasRows(matrix);

  const rows: LegacyAliasSunsetDecisionRow[] = matrixRows.map((entry) => {
    const aliasUsage = usageReport.summary.byAlias[entry.aliasType];
    const blockers = Array.from(new Set([...aliasUsage.blockers]));
    if (!entry.canonicalTarget?.trim()) blockers.push("CANONICAL_TARGET_MISSING");
    if (entry.status === "BLOCKER") blockers.push("MATRIX_BLOCKER");
    if (entry.status === "UNKNOWN_REVIEW") blockers.push("UNKNOWN_REVIEW_STATUS");

    const usageHitsOnPath = usageReport.summary.hitsByLegacyPath[entry.routePath] ?? 0;
    const decisionClass = resolveDecisionClass({
      usageReport,
      matrixEntry: entry,
      aliasType: entry.aliasType,
      aliasWideBlockers: blockers,
      pathHits: usageHitsOnPath,
    });

    return {
      aliasType: entry.aliasType,
      routePath: entry.routePath,
      filePath: entry.filePath,
      canonicalTarget: entry.canonicalTarget,
      matrixStatus: entry.status,
      usageHitsOnPath,
      aliasWideUsageHits: aliasUsage.totalHits,
      aliasWideRecentHits: aliasUsage.recentHits,
      aliasWideLastSeenAt: aliasUsage.lastSeenAt,
      blockers,
      class: decisionClass,
      recommendedAction: resolveRecommendedAction(decisionClass),
      // P0.8 decision pack never cuts routes directly.
      readyForCut: false,
      requiresHumanApproval: true,
    };
  });

  const byClass = createEmptyClassCounts();
  const classes: Record<LegacyAliasDecisionClass, string[]> = {
    KEEP_COMPAT: [],
    READY_FOR_OBSERVATION: [],
    READY_FOR_MIGRATION: [],
    READY_FOR_CUT_REQUIRES_APPROVAL: [],
    BLOCKED: [],
  };

  for (const row of rows) {
    byClass[row.class] += 1;
    classes[row.class].push(row.routePath);
  }

  const blockers = Array.from(
    new Set(rows.flatMap((row) => row.blockers)),
  ).sort((left, right) => left.localeCompare(right));

  let status: LegacyAliasSunsetDecisionStatus;
  let globalDecision: string;
  if (usageReport.status === "LEGACY_ALIAS_USAGE_REPORT_NO_DATA") {
    status = "LEGACY_ALIAS_SUNSET_DECISION_NO_DATA";
    globalDecision =
      "KEEP_COMPAT. Continue telemetry observation and migration prep; no alias is eligible for removal.";
  } else if (byClass.BLOCKED > 0 || usageReport.status === "LEGACY_ALIAS_USAGE_REPORT_BLOCKED") {
    status = "LEGACY_ALIAS_SUNSET_DECISION_BLOCKED";
    globalDecision =
      "BLOCKED. Resolve blockers and complete approval/rollback prerequisites before any sunset action.";
  } else {
    status = "LEGACY_ALIAS_SUNSET_DECISION_READY";
    globalDecision =
      "READY_FOR_CUT_REQUIRES_APPROVAL candidates identified, but route removal still requires explicit human approval.";
  }

  return {
    status,
    generatedAt: new Date().toISOString(),
    usageReportStatus: usageReport.status,
    totals: {
      aliases: rows.length,
      ownerAliases: matrix.summary.counts.ownerAliases,
      campobaseAliases: matrix.summary.counts.campobaseAliases,
      byClass,
    },
    classes,
    requiresHumanApproval: true,
    // Default hard guard for P0.8.
    readyForCut: false,
    globalDecision,
    blockers,
    rollbackChecklist: ROLLBACK_CHECKLIST,
    approvalChecklist: APPROVAL_CHECKLIST,
    rows,
  };
}

function toSummaryOutput(pack: LegacyAliasSunsetDecisionPack): string {
  const lines = [
    pack.status,
    `generatedAt=${pack.generatedAt}`,
    `usageReportStatus=${pack.usageReportStatus}`,
    `aliases.total=${pack.totals.aliases}`,
    `aliases.owner=${pack.totals.ownerAliases}`,
    `aliases.campobase=${pack.totals.campobaseAliases}`,
    `class.KEEP_COMPAT=${pack.totals.byClass.KEEP_COMPAT}`,
    `class.READY_FOR_OBSERVATION=${pack.totals.byClass.READY_FOR_OBSERVATION}`,
    `class.READY_FOR_MIGRATION=${pack.totals.byClass.READY_FOR_MIGRATION}`,
    `class.READY_FOR_CUT_REQUIRES_APPROVAL=${pack.totals.byClass.READY_FOR_CUT_REQUIRES_APPROVAL}`,
    `class.BLOCKED=${pack.totals.byClass.BLOCKED}`,
    `readyForCut=${pack.readyForCut}`,
    `requiresHumanApproval=${pack.requiresHumanApproval}`,
    `globalDecision=${pack.globalDecision}`,
    `blockers=${pack.blockers.join(",") || "none"}`,
  ];
  return `${lines.join("\n")}\n`;
}

function toMarkdownOutput(pack: LegacyAliasSunsetDecisionPack): string {
  const lines = [
    "# Legacy Alias Sunset Decision Pack",
    "",
    `**Status:** ${pack.status}`,
    `**Generated At:** ${pack.generatedAt}`,
    `**Usage Report Status:** ${pack.usageReportStatus}`,
    "",
    "## Totals",
    "",
    `- aliases.total: ${pack.totals.aliases}`,
    `- aliases.owner: ${pack.totals.ownerAliases}`,
    `- aliases.campobase: ${pack.totals.campobaseAliases}`,
    `- class.KEEP_COMPAT: ${pack.totals.byClass.KEEP_COMPAT}`,
    `- class.READY_FOR_OBSERVATION: ${pack.totals.byClass.READY_FOR_OBSERVATION}`,
    `- class.READY_FOR_MIGRATION: ${pack.totals.byClass.READY_FOR_MIGRATION}`,
    `- class.READY_FOR_CUT_REQUIRES_APPROVAL: ${pack.totals.byClass.READY_FOR_CUT_REQUIRES_APPROVAL}`,
    `- class.BLOCKED: ${pack.totals.byClass.BLOCKED}`,
    `- readyForCut: ${pack.readyForCut}`,
    `- requiresHumanApproval: ${pack.requiresHumanApproval}`,
    "",
    "## Global Decision",
    "",
    `- ${pack.globalDecision}`,
    "",
    "## Rollback Checklist",
    "",
    ...pack.rollbackChecklist.map((item) => `- ${item}`),
    "",
    "## Approval Checklist",
    "",
    ...pack.approvalChecklist.map((item) => `- ${item}`),
    "",
  ];

  return `${lines.join("\n")}\n`;
}

export function renderLegacyAliasSunsetDecisionPack(pack: LegacyAliasSunsetDecisionPack, mode: OutputMode): string {
  if (mode === "json") return `${JSON.stringify(pack, null, 2)}\n`;
  if (mode === "markdown") return toMarkdownOutput(pack);
  return toSummaryOutput(pack);
}

export function runLegacyAliasSunsetDecisionCli(argv: string[]): number {
  try {
    const cliArgs = resolveCliArgs(argv);
    const usageReport = buildLegacyAliasUsageReport({
      mode: "json",
      inputPath: cliArgs.usageInputPath,
    });
    const pack = buildLegacyAliasSunsetDecisionPack({
      mode: cliArgs.mode,
      matrixPath: cliArgs.matrixPath,
      usageReport,
    });
    process.stdout.write(renderLegacyAliasSunsetDecisionPack(pack, cliArgs.mode));
    return 0;
  } catch (error) {
    console.error("LEGACY_ALIAS_SUNSET_DECISION_FAILED", error);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const exitCode = runLegacyAliasSunsetDecisionCli(process.argv.slice(2));
  process.exit(exitCode);
}
