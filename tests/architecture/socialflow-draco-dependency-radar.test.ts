import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const SOURCE_DIRS = [
  "src/lib/socialflow",
  "src/app/api/socialflow",
  "apps/socialflow-runtime/src",
  "src/modules/socialflow-app",
] as const;

const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const ALLOWLIST_TODO_COMMENT = "TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.";

type DependencyRule = {
  ruleId: string;
  patternDetected: string;
  violatedRule: string;
  matcher: RegExp;
  appliesToFiles?: string[];
};

type DependencyHit = {
  file: string;
  line: number;
  patternDetected: string;
  violatedRule: string;
  ruleId: string;
  isAllowlisted: boolean;
};

type AllowlistEntry = {
  file: string;
  rules: string[];
  note: string;
};

const directDependencyRules: DependencyRule[] = [
  {
    ruleId: "direct-integration-core-import",
    patternDetected: "@/lib/integration-core/**",
    violatedRule: "Direct import from integration-core is forbidden in SocialFlow LinkedIn boundaries.",
    matcher: /@\/lib\/integration-core(?:\/|["'`]|$)/,
    appliesToFiles: [
      "src/lib/socialflow/linkedin/**",
      "src/lib/socialflow/contracts/linkedin-oauth-runtime.ts",
    ],
  },
  {
    ruleId: "direct-observability-core-import",
    patternDetected: "@/lib/observability-core/**",
    violatedRule: "Direct import from observability-core is forbidden in SocialFlow LinkedIn boundaries.",
    matcher: /@\/lib\/observability-core(?:\/|["'`]|$)/,
    appliesToFiles: [
      "src/lib/socialflow/linkedin/**",
      "src/lib/socialflow/contracts/linkedin-oauth-runtime.ts",
    ],
  },
  {
    ruleId: "direct-lib-db-import",
    patternDetected: "@/lib/db",
    violatedRule: "Direct dependency on global DRACO DB helper is forbidden in SocialFlow boundaries.",
    matcher: /@\/lib\/db/,
  },
  {
    ruleId: "direct-ensure-draco-db",
    patternDetected: "ensureDracoDb",
    violatedRule: "Direct use of ensureDracoDb is forbidden in SocialFlow boundaries.",
    matcher: /\bensureDracoDb\b/,
  },
  {
    ruleId: "direct-bindings-draco-db",
    patternDetected: "bindings?.DRACO_DB",
    violatedRule: "Direct access to bindings?.DRACO_DB is forbidden in SocialFlow boundaries.",
    matcher: /bindings\?\s*\.\s*DRACO_DB/,
  },
  {
    ruleId: "direct-env-draco-db",
    patternDetected: "env.DRACO_DB",
    violatedRule: "Direct access to env.DRACO_DB is forbidden in SocialFlow boundaries.",
    matcher: /\benv\s*\.\s*DRACO_DB\b/,
  },
  {
    ruleId: "direct-draco-db-token",
    patternDetected: "DRACO_DB",
    violatedRule: "Direct DRACO_DB reference is forbidden in SocialFlow boundaries.",
    matcher: /\bDRACO_DB\b/,
  },
  {
    ruleId: "direct-draco-db-variable",
    patternDetected: "dracoDb",
    violatedRule: "Direct dracoDb variable usage is forbidden in SocialFlow boundaries.",
    matcher: /\bdracoDb\b/,
  },
  {
    ruleId: "direct-core-db-variable",
    patternDetected: "coreDb",
    violatedRule: "Direct coreDb usage is forbidden in SocialFlow boundaries.",
    matcher: /\bcoreDb\b/,
  },
];

const sqlCoreTableRules: DependencyRule[] = [
  {
    ruleId: "sql-core-saas",
    patternDetected: "SQL table saas",
    violatedRule: "Direct SQL access to core table `saas` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?saas["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-saas-instances",
    patternDetected: "SQL table saas_instances",
    violatedRule: "Direct SQL access to core table `saas_instances` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?saas_instances["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-saas-domains",
    patternDetected: "SQL table saas_domains",
    violatedRule: "Direct SQL access to core table `saas_domains` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?saas_domains["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-tenant-dossiers",
    patternDetected: "SQL table tenant_strategic_dossiers",
    violatedRule: "Direct SQL access to core table `tenant_strategic_dossiers` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?tenant_strategic_dossiers["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-agent-work-logs",
    patternDetected: "SQL table agent_work_logs",
    violatedRule: "Direct SQL access to core table `agent_work_logs` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?agent_work_logs["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-orchestrator-messages",
    patternDetected: "SQL table orchestrator_messages",
    violatedRule: "Direct SQL access to core table `orchestrator_messages` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?orchestrator_messages["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-economic-events",
    patternDetected: "SQL table economic_events",
    violatedRule: "Direct SQL access to core table `economic_events` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?economic_events["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-drako-integration-connections",
    patternDetected: "SQL table drako_integration_connections",
    violatedRule: "Direct SQL access to core table `drako_integration_connections` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?drako_integration_connections["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-drako-integration-credentials",
    patternDetected: "SQL table drako_integration_credentials",
    violatedRule: "Direct SQL access to core table `drako_integration_credentials` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?drako_integration_credentials["'`\]]?\b/i,
  },
  {
    ruleId: "sql-core-drako-observability-activities",
    patternDetected: "SQL table drako_observability_activities",
    violatedRule: "Direct SQL access to core table `drako_observability_activities` is forbidden in SocialFlow boundaries.",
    matcher: /\b(?:from|join|into|update|table)\s+["'`[]?drako_observability_activities["'`\]]?\b/i,
  },
];

const dependencyRules: DependencyRule[] = [...directDependencyRules, ...sqlCoreTableRules];

const temporaryAllowlist: AllowlistEntry[] = [
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  { file: "src/lib/socialflow/contracts/legacy-actions-core.ts", rules: ["direct-draco-db-token", "direct-bindings-draco-db", "sql-core-tenant-dossiers"], note: ALLOWLIST_TODO_COMMENT },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  { file: "src/modules/socialflow-app/agent-actions.ts", rules: ["direct-draco-db-token", "direct-bindings-draco-db", "sql-core-tenant-dossiers", "sql-core-agent-work-logs"], note: ALLOWLIST_TODO_COMMENT },
  {
    file: "src/lib/socialflow/contracts/export-core-read.ts",
    rules: [
      "direct-lib-db-import",
      "sql-core-saas",
      "sql-core-saas-instances",
      "sql-core-tenant-dossiers",
      "sql-core-agent-work-logs",
      "sql-core-orchestrator-messages",
      "sql-core-economic-events",
      "sql-core-saas-domains",
    ],
    note: ALLOWLIST_TODO_COMMENT,
  },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  { file: "src/lib/socialflow/repository.ts", rules: ["direct-core-db-variable", "direct-draco-db-token"], note: ALLOWLIST_TODO_COMMENT },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  { file: "src/lib/socialflow/linkedin/oauth.ts", rules: ["direct-draco-db-token", "direct-bindings-draco-db", "direct-draco-db-variable"], note: ALLOWLIST_TODO_COMMENT },
  // TODO(SocialFlow DB separation): remove this allowlist when LinkedIn OAuth is SOCIAL_DB-owned and emits Campamento Base events.
  {
    file: "src/lib/socialflow/contracts/linkedin-oauth-runtime.ts",
    rules: ["direct-integration-core-import", "direct-observability-core-import"],
    note: "TODO(SocialFlow DB separation): remove this allowlist when LinkedIn OAuth is SOCIAL_DB-owned and emits Campamento Base events.",
  },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  { file: "apps/socialflow-runtime/src/lib/runtime-env.ts", rules: ["direct-draco-db-token"], note: ALLOWLIST_TODO_COMMENT },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  { file: "apps/socialflow-runtime/src/lib/db/runtime-db.ts", rules: ["direct-ensure-draco-db", "direct-draco-db-token", "direct-draco-db-variable"], note: ALLOWLIST_TODO_COMMENT },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  {
    file: "apps/socialflow-runtime/src/lib/socialflow/exports-service.ts",
    rules: [
      "direct-ensure-draco-db",
      "direct-draco-db-token",
      "direct-draco-db-variable",
      "sql-core-saas",
      "sql-core-tenant-dossiers",
      "sql-core-agent-work-logs",
      "sql-core-orchestrator-messages",
      "sql-core-economic-events",
      "sql-core-saas-domains",
    ],
    note: ALLOWLIST_TODO_COMMENT,
  },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  {
    file: "apps/socialflow-runtime/src/lib/socialflow/contracts/runtime-seed-contract.ts",
    rules: ["direct-ensure-draco-db", "sql-core-saas"],
    note: ALLOWLIST_TODO_COMMENT,
  },
  // TODO(SocialFlow DB separation): remove this allowlist entry when the dependency is moved to SOCIAL_DB or a Campamento Base contract.
  { file: "apps/socialflow-runtime/src/lib/socialflow/exports-service.test.ts", rules: ["direct-ensure-draco-db"], note: ALLOWLIST_TODO_COMMENT },
];

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesGlob(value: string, pattern: string): boolean {
  const matcher = `^${escapeRegex(pattern).replace(/\\\*\\\*/g, ".*").replace(/\\\*/g, "[^/]*")}$`;
  return new RegExp(matcher).test(value);
}

function toRelativeRepoPath(filePath: string): string {
  return normalizePath(path.relative(repoRoot, filePath));
}

function listCodeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listCodeFiles(fullPath);
    if (!CODE_FILE_PATTERN.test(entry) || entry.endsWith(".d.ts")) return [];
    return [fullPath];
  });
}

function formatHit(hit: DependencyHit): string {
  const status = hit.isAllowlisted ? "allowlisted" : "new";
  return `${hit.file}:${hit.line} | pattern=${hit.patternDetected} | rule=${hit.violatedRule} | status=${status}`;
}

function buildAllowlistIndex(entries: AllowlistEntry[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (!entry.note.includes("TODO(SocialFlow DB separation)")) {
      throw new Error(`ALLOWLIST_ENTRY_MISSING_TODO_NOTE: ${entry.file}`);
    }
    index.set(entry.file, new Set(entry.rules));
  }
  return index;
}

function collectDependencyHits(): DependencyHit[] {
  const allowlistIndex = buildAllowlistIndex(temporaryAllowlist);
  const files = SOURCE_DIRS.flatMap((relativeDir) => listCodeFiles(path.join(repoRoot, relativeDir)));
  const hits: DependencyHit[] = [];

  for (const filePath of files) {
    const relativePath = toRelativeRepoPath(filePath);
    const source = readFileSync(filePath, "utf8");
    const lines = source.split(/\r?\n/);
    const allowlistedRules = allowlistIndex.get(relativePath) ?? new Set<string>();

    lines.forEach((lineContent, lineIndex) => {
      for (const rule of dependencyRules) {
        if (rule.appliesToFiles?.length) {
          const applies = rule.appliesToFiles.some((pattern) => matchesGlob(relativePath, pattern));
          if (!applies) continue;
        }
        if (!rule.matcher.test(lineContent)) continue;
        hits.push({
          file: relativePath,
          line: lineIndex + 1,
          patternDetected: rule.patternDetected,
          violatedRule: rule.violatedRule,
          ruleId: rule.ruleId,
          isAllowlisted: allowlistedRules.has(rule.ruleId),
        });
      }
    });
  }

  return hits.sort((left, right) =>
    `${left.file}:${left.line}:${left.ruleId}`.localeCompare(`${right.file}:${right.line}:${right.ruleId}`),
  );
}

function assertNoNewViolations(hits: DependencyHit[]) {
  if (hits.length === 0) return;
  const details = hits.map((hit) => `- ${formatHit(hit)}`).join("\n");
  throw new Error(`NEW_SOCIALFLOW_DRACO_DEPENDENCIES_DETECTED\n${details}`);
}

describe("SocialFlow DRACO dependency radar", () => {
  it("reports legacy allowlisted dependencies and blocks new ones", () => {
    const hits = collectDependencyHits();
    const newViolations = hits.filter((hit) => !hit.isAllowlisted);
    const allowlistedHits = hits.filter((hit) => hit.isAllowlisted);

    console.info("SOCIALFLOW_DRACO_DEPENDENCY_RADAR_TOTAL_HITS", hits.length);
    console.info("SOCIALFLOW_DRACO_DEPENDENCY_RADAR_ALLOWLISTED_HITS", allowlistedHits.length);
    console.info("SOCIALFLOW_DRACO_DEPENDENCY_RADAR_NEW_HITS", newViolations.length);

    expect(allowlistedHits.length).toBeGreaterThan(0);
    expect(newViolations.map(formatHit)).toEqual([]);
  });

  it("fails when a dependency is outside the allowlist", () => {
    expect(() =>
      assertNoNewViolations([{
        file: "src/lib/socialflow/fake.ts",
        line: 12,
        patternDetected: "DRACO_DB",
        violatedRule: "Direct DRACO_DB reference is forbidden in SocialFlow boundaries.",
        ruleId: "direct-draco-db-token",
        isAllowlisted: false,
      }]),
    ).toThrow("NEW_SOCIALFLOW_DRACO_DEPENDENCIES_DETECTED");
  });
});
