import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(fullPath);
    } catch {
      return [];
    }
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

    expect(files.length).toBeGreaterThan(0);

    const forbiddenRuntimeFiles = files.filter((file) => {
      const relative = path.relative(appsDir, file).replace(/\\/g, "/");
      if (
        relative.startsWith("socialflow-runtime/.next/") ||
        relative.startsWith("socialflow-runtime/.open-next/") ||
        relative === "socialflow-runtime/tsconfig.tsbuildinfo"
      ) {
        return false;
      }
      if (relative.startsWith("socialflow-runtime/")) {
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
    expect(matrix).toContain("`apps/socialflow-runtime/*` ya contiene el canary inactivo");
    expect(matrix).toContain("`apps/socialflow-runtime/*` puede compilar y generar artifact local independiente");
    expect(matrix).toContain("`src/app/mentoria/*`, `src/app/api/mentoria/*`, `src/lib/mentoria/*`");
    expect(matrix).toContain(
      "`src/app/socialflow/*`, `src/app/api/socialflow/*`, `src/lib/socialflow/*`, `src/lib/social-core/*`",
    );
    expect(matrix).toContain("`src/app/operator/*`, `src/app/api/operator/*`, `src/lib/campobase/*`");
  });
});
