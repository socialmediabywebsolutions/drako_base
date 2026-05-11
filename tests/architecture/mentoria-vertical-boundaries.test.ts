import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function listMentoriaProductFiles(): string[] {
  return [
    ...listFiles(path.join(repoRoot, "src/lib/mentoria")),
    ...listFiles(path.join(repoRoot, "src/app/api/mentoria")),
  ];
}

describe("Mentoria vertical boundaries", () => {
  it("exposes operator health through a public Mentoria observability contract", () => {
    const contract = read("src/lib/mentoria/contracts/observability.ts");
    const operatorRoute = read("src/app/api/operator/mentoria/health/system/route.ts");

    expect(contract).toContain("getMentoriaOperatorSystemHealth");
    expect(contract).toContain("@/lib/mentoria/resilience/orchestrator");

    expect(operatorRoute).toContain("@/lib/mentoria/contracts/observability");
    expect(operatorRoute).not.toContain("@/lib/mentoria/resilience/orchestrator");
  });

  it("keeps Campamento Base and operator surfaces away from Mentoria internals", () => {
    const files = [
      ...listFiles(path.join(repoRoot, "src/lib/campobase")),
      ...listFiles(path.join(repoRoot, "src/lib/campamento-base")),
      ...listFiles(path.join(repoRoot, "src/app/api/campobase")),
      ...listFiles(path.join(repoRoot, "src/app/api/campamento-base")),
      ...listFiles(path.join(repoRoot, "src/app/api/operator")),
      ...listFiles(path.join(repoRoot, "src/app/operator")),
    ];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/lib\/mentoria\/(?!contracts\/)/);
    }
  });

  it("keeps Mentoria away from SocialFlow product internals", () => {
    const files = listMentoriaProductFiles();
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/@\/lib\/socialflow/);
      expect(source).not.toMatch(/@\/lib\/social\/(ai|repository|live-publishing|scheduler|linkedin-service)/);
      expect(source).not.toMatch(/@\/components\/saas\/socialflow/);
      expect(source).not.toMatch(/\/api\/socialflow\//);
    }
  });

  it("keeps Mentoria product code away from the global DB helper", () => {
    const files = listMentoriaProductFiles();
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toContain("@/lib/db");
    }
  });

  it("keeps the Mentoria worker bound only to product/auth D1 identities", () => {
    const workerConfig = read("workers/mentorias/wrangler.workers.toml");

    expect(workerConfig).toContain('binding = "MENTORIA_DB"');
    expect(workerConfig).toContain('binding = "MENTORIAS_AUTHS_DB"');
    expect(workerConfig).not.toContain('binding = "DRACO_DB"');
    expect(workerConfig).not.toContain('binding = "DB"');
    expect(workerConfig).not.toContain('binding = "SOCIAL_DB"');
  });
});
