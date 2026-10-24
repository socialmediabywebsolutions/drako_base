import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;

type LegacyAliasStatus =
  | "LEGACY_COMPAT_ACCEPTED"
  | "NEEDS_DEPRECATION"
  | "NEEDS_CUT"
  | "BLOCKER"
  | "UNKNOWN_REVIEW";

type LegacyAliasEntry = {
  routePath: string;
  filePath: string;
  currentRole: string;
  canonicalTarget: string;
  status: LegacyAliasStatus;
};

type MatrixSnapshot = {
  summary: {
    counts: {
      ownerAliases: number;
      campobaseAliases: number;
      operatorCanonical: number;
      campamentoBaseCanonical: number;
    };
  };
  legacyAliases: {
    owner: LegacyAliasEntry[];
    campobase: LegacyAliasEntry[];
  };
  canonicalSurfaces: {
    operator: Array<{ routePath: string; filePath: string }>;
    campamentoBase: Array<{ routePath: string; filePath: string }>;
  };
};

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readMatrix(): MatrixSnapshot {
  return JSON.parse(read("docs/config/legacy-alias-deprecation-matrix.json")) as MatrixSnapshot;
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

function toRelative(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(`${repoRoot.replace(/\\/g, "/")}/`, "");
}

function routeFromApiFile(relativePath: string): string {
  const normalized = relativePath.replace(/^src\/app\/api\//, "").replace(/\/route\.[cm]?[jt]sx?$/, "");
  return `/api/${normalized}`.replace(/\/+/g, "/");
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
      if (match[1]) specifiers.add(match[1].trim());
    }
  }

  return Array.from(specifiers).sort();
}

describe("Legacy alias boundaries", () => {
  it("keeps owner/campobase alias inventory pinned and compatibility-only", () => {
    const matrix = readMatrix();
    const ownerFiles = listCodeFiles(path.join(repoRoot, "src/app/api/owner"))
      .filter((file) => /\/route\.[cm]?[jt]sx?$/.test(file.replace(/\\/g, "/")))
      .map(toRelative)
      .sort();
    const campobaseFiles = listCodeFiles(path.join(repoRoot, "src/app/api/campobase"))
      .filter((file) => /\/route\.[cm]?[jt]sx?$/.test(file.replace(/\\/g, "/")))
      .map(toRelative)
      .sort();

    expect(ownerFiles.length).toBe(matrix.summary.counts.ownerAliases);
    expect(campobaseFiles.length).toBe(matrix.summary.counts.campobaseAliases);
    expect(ownerFiles).toEqual(matrix.legacyAliases.owner.map((entry) => entry.filePath).sort());
    expect(campobaseFiles).toEqual(matrix.legacyAliases.campobase.map((entry) => entry.filePath).sort());
  });

  it("keeps owner/campobase routes as legacy bridges to operator/factory only", () => {
    const matrix = readMatrix();
    const allowedStatuses = new Set<LegacyAliasStatus>([
      "LEGACY_COMPAT_ACCEPTED",
      "NEEDS_DEPRECATION",
      "NEEDS_CUT",
      "BLOCKER",
      "UNKNOWN_REVIEW",
    ]);
    const aliasEntries = [...matrix.legacyAliases.owner, ...matrix.legacyAliases.campobase];

    for (const entry of aliasEntries) {
      const source = read(entry.filePath);
      expect(allowedStatuses.has(entry.status)).toBe(true);
      expect(entry.canonicalTarget).toMatch(/^\/api\/(operator|factory)\//);
      expect(entry.routePath).toBe(routeFromApiFile(entry.filePath));
      expect(source).toMatch(/export\s+\{[^}]+\}\s+from\s+"@\/app\/api\/(operator|factory)\//);
      expect(source).not.toMatch(/@\/app\/api\/socialflow\/|@\/app\/api\/mentoria\//);
      expect(source).not.toMatch(/@\/lib\/socialflow\/|@\/lib\/mentoria\//);
    }
  });

  it("keeps campobase aliases explicitly marked as legacy compat", () => {
    const matrix = readMatrix();
    for (const entry of matrix.legacyAliases.campobase) {
      const source = read(entry.filePath);
      expect(source).toContain("LEGACY_CAMPOBASE_COMPAT_ROUTE");
    }
  });

  it("prevents product surfaces from importing owner/campobase legacy internals", () => {
    const productDirs = [
      "apps/socialcors/src/app/api/socialflow",
      "src/app/api/mentoria",
      "src/lib/socialflow",
      "src/lib/mentoria",
    ];
    const forbiddenPatterns = [
      /^@\/app\/api\/owner\//,
      /^@\/app\/api\/campobase\//,
      /^@\/lib\/owner\//,
      /^@\/lib\/campobase\//,
      /^@\/lib\/campamento-base\//,
    ];

    for (const relativeDir of productDirs) {
      for (const file of listCodeFiles(path.join(repoRoot, relativeDir))) {
        const imports = extractImportSpecifiers(readFileSync(file, "utf8"));
        for (const importPath of imports) {
          for (const pattern of forbiddenPatterns) {
            expect(pattern.test(importPath), `${toRelative(file)} imports ${importPath}`).toBe(false);
          }
        }
      }
    }
  });

  it("keeps canonical control-plane surfaces on operator/campamento-base and factory detached", () => {
    const matrix = readMatrix();
    expect(matrix.canonicalSurfaces.operator.length).toBe(matrix.summary.counts.operatorCanonical);
    expect(matrix.canonicalSurfaces.campamentoBase.length).toBe(matrix.summary.counts.campamentoBaseCanonical);

    for (const row of matrix.canonicalSurfaces.operator) {
      expect(row.routePath).toMatch(/^\/api\/operator\//);
    }
    for (const row of matrix.canonicalSurfaces.campamentoBase) {
      expect(row.routePath).toMatch(/^\/api\/campamento-base\//);
    }

    const factoryFiles = [
      ...listCodeFiles(path.join(repoRoot, "src/app/api/factory")),
      ...listCodeFiles(path.join(repoRoot, "src/lib/factory")),
    ];
    for (const file of factoryFiles) {
      const imports = extractImportSpecifiers(readFileSync(file, "utf8"));
      for (const importPath of imports) {
        expect(importPath.startsWith("@/lib/campamento-base/"), `${toRelative(file)} imports ${importPath}`).toBe(false);
        expect(importPath.startsWith("@/lib/campobase/"), `${toRelative(file)} imports ${importPath}`).toBe(false);
      }
    }
  });
});
