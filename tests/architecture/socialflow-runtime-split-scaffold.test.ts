import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function listCodeFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listCodeFiles(fullPath);
    return /\.(ts|tsx|mjs)$/.test(entry) ? [fullPath] : [];
  });
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
}

describe("SocialFlow runtime split scaffold", () => {
  it("creates the future runtime, shared packages and canary worker skeleton", () => {
    const requiredPaths = [
      "apps/socialflow-runtime/package.json",
      "apps/socialflow-runtime/tsconfig.json",
      "apps/socialflow-runtime/next.config.ts",
      "apps/socialflow-runtime/open-next.config.ts",
      "apps/socialflow-runtime/runtime-boundaries.json",
      "apps/socialflow-runtime/src/app/layout.tsx",
      "apps/socialflow-runtime/src/app/page.tsx",
      "apps/socialflow-runtime/src/middleware.ts",
      "packages/shared-neutral/src/hosts.ts",
      "packages/shared-neutral/src/marketing-locales.ts",
      "packages/shared-cloudflare/src/opennext-cloudflare-config.ts",
      "packages/shared-ui-neutral/src/app-providers.tsx",
      "workers/socialflows-runtime-canary/wrangler.workers.toml",
      "workers/socialflows-runtime-canary/src/workers.ts",
      "docs/audits/P2-15-RUNTIME-SPLIT-SCAFFOLD.md",
      "scripts/build-socialflow-runtime-scaffold.mjs",
    ];

    for (const relativePath of requiredPaths) {
      expect(existsSync(path.join(repoRoot, relativePath)), relativePath).toBe(true);
    }
  });

  it("defines explicit safe, temporary and forbidden boundary classes", () => {
    const boundaries = JSON.parse(read("apps/socialflow-runtime/runtime-boundaries.json")) as {
      SAFE_SHARED_PACKAGE: string[];
      TEMP_SHARED: string[];
      FORBIDDEN_SHARED: string[];
    };

    expect(boundaries.SAFE_SHARED_PACKAGE).toEqual(
      expect.arrayContaining([
        "@shared-neutral/hosts",
        "@shared-neutral/marketing-locales",
        "@shared-cloudflare/opennext-cloudflare-config",
        "@shared-ui-neutral/app-providers",
      ]),
    );
    expect(boundaries.TEMP_SHARED).toEqual(
      expect.arrayContaining([
        "@/lib/socialflow/*",
        "@/lib/auths/*",
        "@/lib/db",
        "@/lib/cf",
        "@/lib/correlation",
      ]),
    );
    expect(boundaries.FORBIDDEN_SHARED).toEqual(
      expect.arrayContaining([
        "@/components/layouts/control-plane-layout",
        "@/components/sidebar",
        "@/components/right-panel",
        "@/app/nextauth-providers",
        "@/lib/mentoria/*",
        "@/lib/operator/*",
        "@/lib/campobase/*",
        "@/lib/drako/*",
        "@/lib/owner/*",
        "@/lib/dashboard/*",
        "@/app/(dashboard)/*",
        "@/app/operator/*",
        "@/app/admin/*",
      ]),
    );
  });

  it("keeps the future runtime scaffold and shared packages away from forbidden imports", () => {
    const boundaries = JSON.parse(read("apps/socialflow-runtime/runtime-boundaries.json")) as {
      FORBIDDEN_SHARED: string[];
    };
    const forbiddenMatchers = boundaries.FORBIDDEN_SHARED.map((entry) => new RegExp(escapeRegex(entry)));
    const runtimeFiles = listCodeFiles(path.join(repoRoot, "apps/socialflow-runtime/src"));
    const sharedPackageFiles = [
      ...listCodeFiles(path.join(repoRoot, "packages/shared-neutral/src")),
      ...listCodeFiles(path.join(repoRoot, "packages/shared-cloudflare/src")),
      ...listCodeFiles(path.join(repoRoot, "packages/shared-ui-neutral/src")),
    ];

    expect(runtimeFiles.length).toBeGreaterThan(0);
    expect(sharedPackageFiles.length).toBeGreaterThan(0);

    for (const file of [...runtimeFiles, ...sharedPackageFiles]) {
      const source = readFileSync(file, "utf8");
      for (const matcher of forbiddenMatchers) {
        expect(source).not.toMatch(matcher);
      }
      expect(source).not.toMatch(/next-auth\/react/);
      expect(source).not.toMatch(/@\/components\/mentoria|@\/lib\/mentoria/);
      expect(source).not.toMatch(/@\/components\/operator|@\/components\/owner/);
    }
  });

  it("keeps the canary worker scaffold inert and route-free", () => {
    const wrangler = read("workers/socialflows-runtime-canary/wrangler.workers.toml");
    const workerSource = read("workers/socialflows-runtime-canary/src/workers.ts");

    expect(wrangler).toContain('name = "saas-socialflows-runtime-canary"');
    expect(wrangler).toContain('main = "src/workers.ts"');
    expect(wrangler).toContain("workers_dev = false");
    expect(wrangler).not.toContain("[[routes]]");
    expect(wrangler).not.toContain("custom_domain = true");

    expect(workerSource).toContain("SOCIALFLOW_RUNTIME_CANARY_INACTIVE");
    expect(workerSource).toContain("status: 503");
    expect(workerSource).not.toContain(".open-next/socialflows-standalone");
  });

  it("keeps the scaffold build command additive and non-activating", () => {
    const rootPackage = read("package.json");
    const appPackage = read("apps/socialflow-runtime/package.json");
    const buildScript = read("scripts/build-socialflow-runtime-scaffold.mjs");
    const scaffoldDoc = read("docs/audits/P2-15-RUNTIME-SPLIT-SCAFFOLD.md");

    expect(rootPackage).toContain('"socialflow-runtime:build"');
    expect(appPackage).toContain('"build:scaffold"');
    expect(buildScript).toContain("SOCIALFLOW_RUNTIME_SCAFFOLD_BUILD_OK");
    expect(buildScript).toContain('runtimeRoot: "apps/socialflow-runtime"');
    expect(buildScript).toContain('canaryWorkerRoot: "workers/socialflows-runtime-canary"');
    expect(buildScript).toContain("inactive-scaffold");
    expect(scaffoldDoc).toContain("SAFE_SHARED_PACKAGE");
    expect(scaffoldDoc).toContain("TEMP_SHARED");
    expect(scaffoldDoc).toContain("FORBIDDEN_SHARED");
  });
});
