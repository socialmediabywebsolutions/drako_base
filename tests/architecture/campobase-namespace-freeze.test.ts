import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const SEARCH_DIRS = ["src", "tests", "scripts"];

// This allowlist freezes current legacy imports.
// Policy: it should shrink over time as migration advances, and must never grow
// without explicit architecture justification/checkpoint.
const FROZEN_CAMPOBASE_IMPORT_ALLOWLIST = new Set<string>([
  "src/lib/campobase/clinic-platform.ts::@/lib/campobase/clinic-platform-service",
  "src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/clinic-platform",
  "src/lib/campobase/platform-bootstrap.ts::@/lib/campobase/taskops-platform",
  "src/lib/campobase/taskops-platform.ts::@/lib/campobase/taskops-platform-service",
  "tests/lib/campobase-clinic-platform-service.test.ts::@/lib/campobase/clinic-platform-service",
  "tests/lib/campobase-platform-bootstrap.test.ts::@/lib/campobase/platform-bootstrap",
  "tests/lib/campobase-social-automation-registry.test.ts::@/lib/campobase/social-automation-registry",
  "tests/lib/campobase-taskops-platform-service.test.ts::@/lib/campobase/taskops-platform-service",
  "tests/lib/cross-saas-taskops-flow.test.ts::@/lib/campobase/taskops-platform",
  "tests/lib/factory-orchestrator.test.ts::@/lib/campobase/platform-bootstrap",
  "tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/clinic-platform",
  "tests/lib/saas-contract-definitions.test.ts::@/lib/campobase/taskops-platform",
]);

function listCodeFiles(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) return [];

  return readdirSync(directoryPath).flatMap((entry: string) => {
    const fullPath = path.join(directoryPath, entry);
    const entryStat = statSync(fullPath);

    if (entryStat.isDirectory()) {
      return listCodeFiles(fullPath);
    }

    if (!CODE_FILE_PATTERN.test(entry) || entry.endsWith(".d.ts")) {
      return [];
    }

    return [fullPath];
  });
}

function toRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(`${REPO_ROOT.replace(/\\/g, "/")}/`, "");
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
      if (specifier) {
        specifiers.add(specifier);
      }
    }
  }

  return [...specifiers].sort();
}

function collectCampobaseImportEdges(): string[] {
  const edges = new Set<string>();

  for (const relativeDir of SEARCH_DIRS) {
    const absoluteDir = path.join(REPO_ROOT, relativeDir);
    for (const filePath of listCodeFiles(absoluteDir)) {
      const source = readFileSync(filePath, "utf8");
      const relativePath = toRelativePath(filePath);
      const imports = extractImportSpecifiers(source);

      for (const importPath of imports) {
        if (importPath.startsWith("@/lib/campobase")) {
          edges.add(`${relativePath}::${importPath}`);
        }
      }
    }
  }

  return [...edges].sort();
}

describe("campobase namespace freeze", () => {
  it("keeps frozen legacy campobase imports within the allowlist", () => {
    const foundEdges = collectCampobaseImportEdges();
    const unexpected = foundEdges.filter((edge) => !FROZEN_CAMPOBASE_IMPORT_ALLOWLIST.has(edge));

    expect(foundEdges.length).toBeGreaterThan(0);
    expect(unexpected).toEqual([]);
  });

  it("keeps the allowlist pinned for controlled shrink-only migrations", () => {
    expect(FROZEN_CAMPOBASE_IMPORT_ALLOWLIST.size).toBe(12);
  });
});
