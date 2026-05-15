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
    return [fullPath];
  });
}

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("canonical product map", () => {
  it("keeps apps as legacy manifests except the explicit inactive SocialFlow runtime scaffold", () => {
    const appsDir = path.join(repoRoot, "apps");
    const files = listFiles(appsDir);
    const allowedSocialFlowRuntimeFiles = new Set([
      "socialflow-runtime/package.json",
      "socialflow-runtime/tsconfig.json",
      "socialflow-runtime/next.config.ts",
      "socialflow-runtime/open-next.config.ts",
      "socialflow-runtime/runtime-boundaries.json",
      "socialflow-runtime/src/app/layout.tsx",
      "socialflow-runtime/src/app/page.tsx",
      "socialflow-runtime/src/middleware.ts",
    ]);

    expect(files.length).toBeGreaterThan(0);

    const forbiddenRuntimeFiles = files.filter((file) => {
      const relative = path.relative(appsDir, file).replace(/\\/g, "/");
      if (allowedSocialFlowRuntimeFiles.has(relative)) {
        return false;
      }
      const baseName = path.basename(file);
      return (
        baseName === "package.json" ||
        baseName === "wrangler.toml" ||
        baseName === "wrangler.jsonc" ||
        relative.startsWith("src/") ||
        relative.includes("/src/") ||
        relative.startsWith("api/") ||
        relative.includes("/api/")
      );
    });

    expect(forbiddenRuntimeFiles).toEqual([]);
  });

  it("documents the current canonical product surfaces outside apps", () => {
    const matrix = read("docs/knowledge-pack/10_matriz_global_de_rutas_y_entrypoints.md");

    expect(matrix).toContain("## 0) Mapa canonico de producto");
    expect(matrix).toContain("`apps/*` no es runtime canonico");
    expect(matrix).toContain("`apps/socialflow-runtime/*` solo existe como scaffold inactivo");
    expect(matrix).toContain("`src/app/mentoria/*`, `src/app/api/mentoria/*`, `src/lib/mentoria/*`");
    expect(matrix).toContain(
      "`src/app/socialflow/*`, `src/app/api/socialflow/*`, `src/lib/socialflow/*`, `src/lib/social-core/*`",
    );
    expect(matrix).toContain("`src/app/operator/*`, `src/app/api/operator/*`, `src/lib/campobase/*`");
  });
});
