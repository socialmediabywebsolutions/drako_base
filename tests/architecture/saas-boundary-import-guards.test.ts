import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

type ForbiddenImportRule = {
  pattern: string;
  allowedContracts?: string[];
};

type BoundaryRule = {
  ruleId: string;
  sourceDirs: string[];
  forbiddenImports: ForbiddenImportRule[];
};

type BoundaryViolation = {
  ruleId: string;
  file: string;
  importPath: string;
  forbiddenPattern: string;
};

const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;

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

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/");
}

function toRelativeRepoPath(file: string): string {
  return normalizePath(path.relative(repoRoot, file));
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesGlob(value: string, pattern: string): boolean {
  const matcher = `^${escapeRegex(pattern).replace(/\\\*\\\*/g, ".*").replace(/\\\*/g, "[^/]*")}$`;
  return new RegExp(matcher).test(value);
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["'`]([^"'`]+)["'`]/g,
    /\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const specifier = match[1]?.trim();
      if (specifier) specifiers.add(specifier);
    }
  }

  return Array.from(specifiers).sort();
}

function isAllowedByContracts(importPath: string, allowedContracts: string[] | undefined): boolean {
  if (!allowedContracts?.length) return false;
  return allowedContracts.some((pattern) => matchesGlob(importPath, pattern));
}

function collectBoundaryViolations(rules: BoundaryRule[]): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];

  for (const rule of rules) {
    const files = rule.sourceDirs.flatMap((relativeDir) => listCodeFiles(path.join(repoRoot, relativeDir)));

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const imports = extractImportSpecifiers(source);

      for (const importPath of imports) {
        for (const forbiddenRule of rule.forbiddenImports) {
          if (!matchesGlob(importPath, forbiddenRule.pattern)) continue;
          if (isAllowedByContracts(importPath, forbiddenRule.allowedContracts)) continue;

          violations.push({
            ruleId: rule.ruleId,
            file: toRelativeRepoPath(file),
            importPath,
            forbiddenPattern: forbiddenRule.pattern,
          });
        }
      }
    }
  }

  return violations.sort((left, right) =>
    `${left.ruleId}|${left.file}|${left.importPath}`.localeCompare(`${right.ruleId}|${right.file}|${right.importPath}`),
  );
}

const boundaryRules: BoundaryRule[] = [
  {
    ruleId: "campobase-no-product-internals",
    sourceDirs: ["src/lib/campobase", "src/lib/campamento-base"],
    forbiddenImports: [
      {
        pattern: "@/lib/socialflow/**",
        allowedContracts: ["@/lib/socialflow/contracts/**"],
      },
      {
        pattern: "@/modules/socialflow-app/**",
      },
      {
        pattern: "@/lib/mentoria/**",
        allowedContracts: ["@/lib/mentoria/contracts/**"],
      },
    ],
  },
  {
    ruleId: "owner-no-product-internals",
    sourceDirs: ["src/lib/owner"],
    forbiddenImports: [
      {
        pattern: "@/lib/socialflow/**",
        allowedContracts: ["@/lib/socialflow/contracts/**"],
      },
      {
        pattern: "@/modules/socialflow-app/**",
      },
      {
        pattern: "@/lib/mentoria/**",
        allowedContracts: ["@/lib/mentoria/contracts/**"],
      },
    ],
  },
  {
    ruleId: "operator-api-no-product-internals",
    sourceDirs: ["src/app/api/operator"],
    forbiddenImports: [
      {
        pattern: "@/lib/socialflow/**",
        allowedContracts: ["@/lib/socialflow/contracts/**"],
      },
      {
        pattern: "@/lib/mentoria/**",
        allowedContracts: ["@/lib/mentoria/contracts/**"],
      },
      {
        pattern: "@/modules/socialflow-app/**",
      },
      {
        pattern: "@/app/api/mentoria/**",
      },
      {
        pattern: "@/app/api/socialflow/**",
      },
    ],
  },
  {
    ruleId: "mentoria-no-socialflow-imports",
    sourceDirs: ["src/lib/mentoria"],
    forbiddenImports: [
      {
        pattern: "@/lib/socialflow/**",
      },
      {
        pattern: "@/modules/socialflow-app/**",
      },
    ],
  },
  {
    ruleId: "socialflow-no-mentoria-imports",
    sourceDirs: ["src/lib/socialflow"],
    forbiddenImports: [
      {
        pattern: "@/lib/mentoria/**",
      },
    ],
  },
  {
    ruleId: "socialflow-linkedin-no-core-coupling",
    sourceDirs: ["src/lib/socialflow/linkedin"],
    forbiddenImports: [
      {
        pattern: "@/lib/integration-core/**",
      },
      {
        pattern: "@/lib/observability-core/**",
      },
      {
        pattern: "@/lib/db",
      },
    ],
  },
  {
    ruleId: "shared-no-product-runtime-imports",
    sourceDirs: ["packages/shared"],
    forbiddenImports: [
      {
        pattern: "@/lib/mentoria/**",
      },
      {
        pattern: "@/lib/socialflow/**",
      },
      {
        pattern: "@/modules/socialflow-app/**",
      },
      {
        pattern: "@/app/mentoria/**",
      },
      {
        pattern: "@/app/socialflow/**",
      },
      {
        pattern: "@/app/api/mentoria/**",
      },
      {
        pattern: "@/app/api/socialflow/**",
      },
    ],
  },
];

describe("SaaS boundary import guards", () => {
  it("keeps Mentoria publishing flows on a neutral social publishing capability", () => {
    const acquisitionPublishingPath = path.join(repoRoot, "src/lib/mentoria/acquisition-publishing.ts");
    const resiliencePublishingPath = path.join(repoRoot, "src/lib/mentoria/resilience/socialflow-validation.ts");
    const acquisitionSource = readFileSync(acquisitionPublishingPath, "utf8");
    const resilienceSource = readFileSync(resiliencePublishingPath, "utf8");

    expect(acquisitionSource).toContain('@/lib/capabilities/social-publishing/publisher');
    expect(resilienceSource).toContain('@/lib/capabilities/social-publishing/publisher');
    expect(acquisitionSource).not.toContain('@/lib/social-core/publishing');
    expect(resilienceSource).not.toContain('@/lib/social-core/publishing');
  });

  it("keeps Campamento Base SocialFlow service behind the campobase contract adapter", () => {
    const socialflowServicePath = path.join(repoRoot, "src/lib/campobase/socialflow-service.ts");
    const source = readFileSync(socialflowServicePath, "utf8");

    expect(source).toContain('@/lib/socialflow/contracts/campobase');
    expect(source).not.toContain('@/lib/socialflow/contracts/automation');
    expect(source).not.toContain('@/lib/socialflow/contracts/observability');
    expect(source).not.toContain('@/lib/socialflow/contracts/operator-actions');
    expect(source).not.toContain('@/lib/socialflow/repository');
  });

  it("blocks prohibited imports between Campamento Base, operator, products and shared runtime", () => {
    const violations = collectBoundaryViolations(boundaryRules);

    expect(
      violations.map((violation) =>
        `${violation.ruleId} | ${violation.file} | ${violation.importPath} | ${violation.forbiddenPattern}`,
      ),
    ).toEqual([]);
  });
});
