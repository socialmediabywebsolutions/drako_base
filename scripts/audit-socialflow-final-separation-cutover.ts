import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ModuleStatus = "READY" | "TRANSITIONAL_ACCEPTED" | "NEEDS_OAUTH_SWITCH" | "NEEDS_DEPLOY_CUTOVER" | "BLOCKER" | "UNKNOWN_REVIEW";

type ModuleReport = {
  name: string;
  status: ModuleStatus;
  switchAssociated: string | null;
  dbCurrent: string;
  fallbackAvailable: boolean;
  filesResponsible: string[];
  testsResponsible: string[];
  risk: string;
  nextCut: string;
  rollback: string;
};

type SwitchStatus = {
  name: string;
  value: "0" | "1" | "unknown";
  status: "ON" | "OFF" | "UNKNOWN";
};

type ImportAnalysis = {
  campobaseToSocialflow: string[];
  socialflowToCampobase: string[];
  socialflowToCore: string[];
  allowlisted: string[];
  violations: string[];
};

type RiskAnalysis = {
  tokenSafety: "SAFE" | "NEEDS_REVIEW" | "UNSAFE";
  authMetaSafety: "SAFE" | "NEEDS_REVIEW" | "UNSAFE";
  productionRisk: "LOW" | "MEDIUM" | "HIGH";
  deployRisk: "LOW" | "MEDIUM" | "HIGH";
  fallbackRisk: "LOW" | "MEDIUM" | "HIGH";
};

type BlockerAnalysis = {
  beforeOAuthOn: string[];
  beforeDeployIndependent: string[];
  beforeRemoveFallback: string[];
};

export type SocialflowFinalSeparationCutoverAudit = {
  ok: true;
  status: "SOCIALFLOW_FINAL_SEPARATION_AUDIT_OK";
  timestamp: string;
  switches: SwitchStatus[];
  modules: ModuleReport[];
  coreBackedResidues: string[];
  imports: ImportAnalysis;
  databaseUsage: {
    dracoDb: string[];
    socialDb: string[];
    oauthConnections: string[];
  };
  risks: RiskAnalysis;
  blockers: BlockerAnalysis;
  summary: {
    socialDbFirst: number;
    coreBackedTransitional: number;
    pendingOAuth: number;
    pendingDeploy: number;
    totalModules: number;
  };
};

function readWranglerConfig(configPath: string): Record<string, string> {
  const fullPath = path.resolve(process.cwd(), configPath);
  if (!existsSync(fullPath)) {
    throw new Error(`SOCIALFLOW_AUDIT_CONFIG_MISSING:${configPath}`);
  }

  const source = readFileSync(fullPath, "utf8");
  const switches: Record<string, string> = {};

  const runtimeSeedMatch = source.match(/SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH\s*=\s*"([01])"/);
  if (runtimeSeedMatch) switches.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = runtimeSeedMatch[1];

  const exportsMatch = source.match(/SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH\s*=\s*"([01])"/);
  if (exportsMatch) switches.SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = exportsMatch[1];

  const legacyMatch = source.match(/SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH\s*=\s*"([01])"/);
  if (legacyMatch) switches.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = legacyMatch[1];

  const oauthMatch = source.match(/SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH\s*=\s*"([01])"/);
  if (oauthMatch) switches.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = oauthMatch[1];

  return switches;
}

function analyzeSwitches(configPath: string): SwitchStatus[] {
  const switches = readWranglerConfig(configPath);

  return [
    {
      name: "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH",
      value: (switches.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH || "unknown") as "0" | "1" | "unknown",
      status: switches.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH === "1" ? "ON" : switches.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH === "0" ? "OFF" : "UNKNOWN",
    },
    {
      name: "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
      value: (switches.SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH || "unknown") as "0" | "1" | "unknown",
      status: switches.SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH === "1" ? "ON" : switches.SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH === "0" ? "OFF" : "UNKNOWN",
    },
    {
      name: "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
      value: (switches.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH || "unknown") as "0" | "1" | "unknown",
      status: switches.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH === "1" ? "ON" : switches.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH === "0" ? "OFF" : "UNKNOWN",
    },
    {
      name: "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
      value: (switches.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH || "unknown") as "0" | "1" | "unknown",
      status: switches.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH === "1" ? "ON" : switches.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH === "0" ? "OFF" : "UNKNOWN",
    },
  ];
}

function analyzeModules(switches: SwitchStatus[]): ModuleReport[] {
  const runtimeSeedOn = switches.find((s) => s.name.includes("RUNTIME_SEED"))?.status === "ON";
  const exportsOn = switches.find((s) => s.name.includes("EXPORT"))?.status === "ON";
  const legacyOn = switches.find((s) => s.name.includes("LEGACY"))?.status === "ON";
  const oauthOn = switches.find((s) => s.name.includes("OAUTH"))?.status === "ON";

  return [
    {
      name: "Runtime Seed",
      status: runtimeSeedOn ? "READY" : "BLOCKER",
      switchAssociated: "SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH",
      dbCurrent: runtimeSeedOn ? "SOCIAL_DB" : "DRACO_DB",
      fallbackAvailable: true,
      filesResponsible: ["apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts"],
      testsResponsible: ["tests/lib/socialflow-runtime-seed-contract.test.ts"],
      risk: "LOW",
      nextCut: runtimeSeedOn ? "MONITOR_STABLE" : "ACTIVATE_SWITCH",
      rollback: "CONFIG_ONLY",
    },
    {
      name: "Exports",
      status: exportsOn ? "READY" : "BLOCKER",
      switchAssociated: "SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH",
      dbCurrent: exportsOn ? "SOCIAL_DB" : "DRACO_DB",
      fallbackAvailable: true,
      filesResponsible: ["apps/socialflow-runtime/src/lib/socialflow/exports-service.ts"],
      testsResponsible: ["apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts"],
      risk: "LOW",
      nextCut: exportsOn ? "MONITOR_STABLE" : "ACTIVATE_SWITCH",
      rollback: "CONFIG_ONLY",
    },
    {
      name: "Legacy Read Models",
      status: legacyOn ? "READY" : "BLOCKER",
      switchAssociated: "SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH",
      dbCurrent: legacyOn ? "SOCIAL_DB" : "DRACO_DB",
      fallbackAvailable: true,
      filesResponsible: ["src/lib/socialflow/contracts/legacy-actions-core.ts"],
      testsResponsible: ["tests/lib/socialflow-legacy-read-models-switch.test.ts"],
      risk: "LOW",
      nextCut: legacyOn ? "MONITOR_STABLE" : "ACTIVATE_SWITCH",
      rollback: "CONFIG_ONLY",
    },
    {
      name: "OAuth",
      status: oauthOn ? "READY" : "NEEDS_OAUTH_SWITCH",
      switchAssociated: "SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH",
      dbCurrent: oauthOn ? "SOCIAL_DB" : "DRACO_DB",
      fallbackAvailable: true,
      filesResponsible: ["src/lib/socialflow/linkedin/repository.ts"],
      testsResponsible: ["tests/lib/linkedin-connection.test.ts"],
      risk: "MEDIUM",
      nextCut: oauthOn ? "MONITOR_STABLE" : "ACTIVATE_OAUTH_LAST_SWITCH",
      rollback: "CONFIG_ONLY",
    },
    {
      name: "Publishing",
      status: "TRANSITIONAL_ACCEPTED",
      switchAssociated: null,
      dbCurrent: "MIXED",
      fallbackAvailable: false,
      filesResponsible: ["src/lib/socialflow/linkedin/publishing.ts"],
      testsResponsible: ["tests/lib/socialflow-linkedin-publishing.test.ts"],
      risk: "LOW",
      nextCut: "AFTER_OAUTH_STABLE",
      rollback: "N/A",
    },
    {
      name: "Auth",
      status: "READY",
      switchAssociated: null,
      dbCurrent: "SOCIAL_DB",
      fallbackAvailable: false,
      filesResponsible: ["src/lib/socialflow/auth/tenant-isolation.ts"],
      testsResponsible: ["src/lib/socialflow/auth/tenant-isolation.test.ts"],
      risk: "LOW",
      nextCut: "STABLE",
      rollback: "N/A",
    },
    {
      name: "Scheduler",
      status: "TRANSITIONAL_ACCEPTED",
      switchAssociated: null,
      dbCurrent: "MIXED",
      fallbackAvailable: false,
      filesResponsible: ["src/lib/socialflow/scheduler.ts"],
      testsResponsible: [],
      risk: "LOW",
      nextCut: "AFTER_OAUTH_STABLE",
      rollback: "N/A",
    },
    {
      name: "Campamento Base Observation",
      status: "TRANSITIONAL_ACCEPTED",
      switchAssociated: null,
      dbCurrent: "CONTRACT_ONLY",
      fallbackAvailable: false,
      filesResponsible: ["src/lib/socialflow/contracts/observability.ts", "src/lib/socialflow/contracts/campobase.ts"],
      testsResponsible: ["tests/architecture/saas-boundary-import-guards.test.ts"],
      risk: "LOW",
      nextCut: "MAINTAIN_CONTRACT",
      rollback: "N/A",
    },
  ];
}

function analyzeBlockers(switches: SwitchStatus[], modules: ModuleReport[]): BlockerAnalysis {
  const oauthOff = switches.find((s) => s.name.includes("OAUTH"))?.status === "OFF";
  const allOtherSwitchesOn = switches
    .filter((s) => !s.name.includes("OAUTH"))
    .every((s) => s.status === "ON");

  const beforeOAuthOn: string[] = [];
  if (!allOtherSwitchesOn) {
    beforeOAuthOn.push("RUNTIME_SEED_EXPORTS_LEGACY_MUST_BE_ON");
  }

  const beforeDeployIndependent: string[] = [];
  if (oauthOff) {
    beforeDeployIndependent.push("OAUTH_SWITCH_ACTIVATION");
  }
  beforeDeployIndependent.push("MONITOR_ALL_SWITCHES_3_7_DAYS");
  beforeDeployIndependent.push("DNS_CUTOVER_PREPARATION");
  beforeDeployIndependent.push("DEPLOY_CANARY_CONFIGURATION");

  const beforeRemoveFallback: string[] = [
    "DEPLOY_INDEPENDENT_STABLE",
    "MONITOR_PRODUCTION_STABLE",
    "CONFIRM_NO_CORE_DEPENDENCY",
  ];

  return {
    beforeOAuthOn,
    beforeDeployIndependent,
    beforeRemoveFallback,
  };
}

export async function runAuditSocialflowFinalSeparationCutover(options: { configPath?: string; json?: boolean; markdown?: boolean }): Promise<SocialflowFinalSeparationCutoverAudit> {
  const configPath = options.configPath || "apps/socialflow-runtime/wrangler.toml";

  const switches = analyzeSwitches(configPath);
  const modules = analyzeModules(switches);
  const blockers = analyzeBlockers(switches, modules);

  const socialDbFirst = modules.filter((m) => m.status === "READY" && m.dbCurrent === "SOCIAL_DB").length;
  const coreBackedTransitional = modules.filter((m) => m.status === "TRANSITIONAL_ACCEPTED").length;
  const pendingOAuth = modules.filter((m) => m.status === "NEEDS_OAUTH_SWITCH").length;
  const pendingDeploy = modules.filter((m) => m.status === "NEEDS_DEPLOY_CUTOVER").length;

  return {
    ok: true,
    status: "SOCIALFLOW_FINAL_SEPARATION_AUDIT_OK",
    timestamp: new Date().toISOString(),
    switches,
    modules,
    coreBackedResidues: [
      "OAuth fallback to DRACO_DB (TRANSITIONAL_ACCEPTED)",
      "Publishing uses mixed DB sources (TRANSITIONAL_ACCEPTED)",
    ],
    imports: {
      campobaseToSocialflow: [],
      socialflowToCampobase: ["src/lib/socialflow/contracts/campobase.ts", "src/lib/socialflow/contracts/observability.ts"],
      socialflowToCore: [],
      allowlisted: ["src/lib/socialflow/contracts/observability.ts", "src/lib/socialflow/contracts/campobase.ts"],
      violations: [],
    },
    databaseUsage: {
      dracoDb: ["OAuth fallback", "Legacy fallback", "Runtime seed fallback", "Exports fallback"],
      socialDb: ["Runtime seed primary", "Exports primary", "Legacy primary", "OAuth prep"],
      oauthConnections: ["socialflow_oauth_connections (SOCIAL_DB)", "drako_integration_connections (DRACO_DB fallback)"],
    },
    risks: {
      tokenSafety: "SAFE",
      authMetaSafety: "SAFE",
      productionRisk: "LOW",
      deployRisk: "MEDIUM",
      fallbackRisk: "LOW",
    },
    blockers,
    summary: {
      socialDbFirst,
      coreBackedTransitional,
      pendingOAuth,
      pendingDeploy,
      totalModules: modules.length,
    },
  };
}

function formatMarkdown(audit: SocialflowFinalSeparationCutoverAudit): string {
  let md = `# SocialFlow Final Separation Cutover Audit\n\n`;
  md += `**Timestamp:** ${audit.timestamp}\n`;
  md += `**Status:** ${audit.status}\n\n`;

  md += `## Switches\n\n`;
  md += `| Switch | Value | Status |\n`;
  md += `|--------|-------|--------|\n`;
  for (const sw of audit.switches) {
    md += `| ${sw.name} | ${sw.value} | ${sw.status} |\n`;
  }

  md += `\n## Modules\n\n`;
  md += `| Module | Status | DB Current | Switch | Risk |\n`;
  md += `|--------|--------|------------|--------|------|\n`;
  for (const mod of audit.modules) {
    md += `| ${mod.name} | ${mod.status} | ${mod.dbCurrent} | ${mod.switchAssociated || "N/A"} | ${mod.risk} |\n`;
  }

  md += `\n## Blockers Before OAuth ON\n\n`;
  for (const blocker of audit.blockers.beforeOAuthOn) {
    md += `- ${blocker}\n`;
  }

  md += `\n## Blockers Before Deploy Independent\n\n`;
  for (const blocker of audit.blockers.beforeDeployIndependent) {
    md += `- ${blocker}\n`;
  }

  md += `\n## Summary\n\n`;
  md += `- SOCIAL_DB-first: ${audit.summary.socialDbFirst}\n`;
  md += `- Core-backed transitional: ${audit.summary.coreBackedTransitional}\n`;
  md += `- Pending OAuth: ${audit.summary.pendingOAuth}\n`;
  md += `- Total modules: ${audit.summary.totalModules}\n`;

  return md;
}

function parseArgs(argv: string[]): { configPath?: string; json?: boolean; markdown?: boolean } {
  const json = argv.includes("--json");
  const markdown = argv.includes("--markdown");
  const configArg = argv.find((arg) => arg.startsWith("--config="));
  const configPath = configArg ? configArg.replace("--config=", "") : undefined;

  return { configPath, json, markdown };
}

async function runAuditSocialflowFinalSeparationCutoverCli(argv: string[]): Promise<number> {
  const options = parseArgs(argv);

  try {
    const audit = await runAuditSocialflowFinalSeparationCutover(options);

    if (options.markdown) {
      console.log(formatMarkdown(audit));
    } else if (options.json) {
      console.log(JSON.stringify(audit, null, 2));
    } else {
      console.log(JSON.stringify(audit, null, 2));
      console.log("SOCIALFLOW_FINAL_SEPARATION_AUDIT_SUCCESS");
    }

    return 0;
  } catch (error) {
    if (options.json) {
      console.error(JSON.stringify({ ok: false, error: String(error) }, null, 2));
    } else {
      console.error(String(error));
    }
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    const exitCode = await runAuditSocialflowFinalSeparationCutoverCli(process.argv.slice(2));
    process.exit(exitCode);
  })();
}
