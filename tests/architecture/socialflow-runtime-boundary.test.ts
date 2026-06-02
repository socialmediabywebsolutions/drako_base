import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(read(relativePath)) as T;
}

type AuditSnapshot = {
  mode: string;
  bindings: Record<string, { detected: boolean; classification: string; codePaths: string[] }>;
  blockers: Array<{ id: string; classification: string; files: string[] }>;
  warnings: Array<{ id: string }>;
  recommendationsP18B: Array<{ priority: number; action: string }>;
};

describe("SocialFlow runtime boundary audit snapshot", () => {
  it("publishes the audit snapshot and markdown summary", () => {
    expect(existsSync(path.join(repoRoot, "docs/config/socialflow-runtime-boundary-audit.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "docs/architecture/socialflow-runtime-boundary-audit.md"))).toBe(true);

    const markdown = read("docs/architecture/socialflow-runtime-boundary-audit.md");
    expect(markdown).toContain("# SocialFlow Runtime Boundary Audit");
    expect(markdown).toContain("## Blockers");
    expect(markdown).toContain("## Recommendation For P1.8B");
  });

  it("keeps blockers explicit instead of silently claiming independence", () => {
    const snapshot = readJson<AuditSnapshot>("docs/config/socialflow-runtime-boundary-audit.json");

    expect(snapshot.mode).toBe("audit-only");
    expect(snapshot.blockers.length).toBeGreaterThan(0);
    expect(snapshot.blockers.map((item) => item.id)).toEqual([
      "shared-draco-binding-still-required",
      "legacy-core-projection-context",
      "runtime-seed-core-fallback",
      "export-core-read-fallback",
      "linkedin-oauth-core-projection",
    ]);

    for (const blocker of snapshot.blockers) {
      expect(blocker.classification.startsWith("BLOCKER_")).toBe(true);
      expect(blocker.files.length).toBeGreaterThan(0);
    }
  });

  it("records the binding boundary as mixed instead of SOCIAL_DB-only", () => {
    const snapshot = readJson<AuditSnapshot>("docs/config/socialflow-runtime-boundary-audit.json");

    expect(snapshot.bindings.SOCIAL_DB?.detected).toBe(true);
    expect(snapshot.bindings.DRACO_DB?.detected).toBe(true);
    expect(snapshot.bindings.DRACO_DB?.classification).toBe("BLOCKER_SHARED_DB");
    expect(snapshot.bindings.SAASES_DB?.detected).toBe(true);
    expect(snapshot.bindings.SAASES_DB?.codePaths).toEqual([]);
    expect(snapshot.warnings.some((warning) => warning.id === "saases-db-boundary-still-attached")).toBe(true);
    expect(snapshot.recommendationsP18B.length).toBeGreaterThan(0);
  });
});
