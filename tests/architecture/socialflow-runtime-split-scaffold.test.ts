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
      "apps/socialflow-runtime/wrangler.toml",
      "apps/socialflow-runtime/runtime-boundaries.json",
      "apps/socialflow-runtime/src/app/layout.tsx",
      "apps/socialflow-runtime/src/app/page.tsx",
      "apps/socialflow-runtime/src/middleware.ts",
      "apps/socialflow-runtime/src/lib/runtime-env.ts",
      "apps/socialflow-runtime/src/lib/db/runtime-db.ts",
      "apps/socialflow-runtime/src/lib/auth/session.ts",
      "apps/socialflow-runtime/src/lib/auth/service.ts",
      "apps/socialflow-runtime/src/lib/socialflow/contracts.ts",
      "apps/socialflow-runtime/src/lib/socialflow/validators.ts",
      "apps/socialflow-runtime/src/lib/socialflow/runtime-repository-core.ts",
      "apps/socialflow-runtime/src/lib/socialflow/campaigns-repository.ts",
      "apps/socialflow-runtime/src/lib/socialflow/posts-repository.ts",
      "apps/socialflow-runtime/src/lib/socialflow/profile-repository.ts",
      "apps/socialflow-runtime/src/lib/socialflow/live-publishing-service.ts",
      "apps/socialflow-runtime/src/lib/socialflow/exports-service.ts",
      "packages/shared-neutral/src/hosts.ts",
      "packages/shared-neutral/src/marketing-locales.ts",
      "packages/shared-cloudflare/src/opennext-cloudflare-config.ts",
      "packages/shared-ui-neutral/src/app-providers.tsx",
      "workers/socialflows-runtime-canary/wrangler.workers.toml",
      "workers/socialflows-runtime-canary/src/workers.ts",
      "docs/audits/P2-15-RUNTIME-SPLIT-SCAFFOLD.md",
      "docs/audits/P2-16-SOCIALFLOW-RUNTIME-PORT.md",
      "scripts/build-socialflow-runtime-scaffold.mjs",
      "scripts/build-socialflow-runtime.mjs",
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
        "@/lib/auth/crypto",
        "@/lib/cloudflare/runtime",
      ]),
    );
    expect(boundaries.TEMP_SHARED).toEqual(
      expect.arrayContaining([
        "@/lib/socialflow/ai/*",
        "@/lib/socialflow/linkedin/*",
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
      expect(source).not.toMatch(/@\/lib\/auths\//);
      expect(source).not.toMatch(/@\/modules\/socialflow-app\//);
      expect(source).not.toMatch(/@\/components\/auth\//);
      expect(source).not.toMatch(/@\/components\/settings\/socialflow-account-settings/);
      expect(source).not.toMatch(/@\/components\/ui\//);
      expect(source).not.toMatch(/@\/lib\/db\b/);
      expect(source).not.toMatch(/@\/lib\/http\/errors/);
      expect(source).not.toMatch(/@\/lib\/cf\b/);
      expect(source).not.toMatch(/@\/lib\/correlation\b/);
      expect(source).not.toMatch(/@\/lib\/tenants\/services/);
      expect(source).not.toMatch(/@\/app\/api\/socialflow\//);
      expect(source).not.toMatch(/@\/lib\/socialflow\/repository\b/);
      expect(source).not.toMatch(/@\/lib\/socialflow\/profile\/repository\b/);
      expect(source).not.toMatch(/@\/lib\/socialflow\/live-publishing\b/);
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
    const runtimeBuildScript = read("scripts/build-socialflow-runtime.mjs");
    const scaffoldDoc = read("docs/audits/P2-15-RUNTIME-SPLIT-SCAFFOLD.md");
    const portDoc = read("docs/audits/P2-16-SOCIALFLOW-RUNTIME-PORT.md");

    expect(rootPackage).toContain('"socialflow-runtime:build"');
    expect(appPackage).toContain('"build:scaffold"');
    expect(buildScript).toContain("SOCIALFLOW_RUNTIME_SCAFFOLD_BUILD_OK");
    expect(buildScript).toContain('runtimeRoot: "apps/socialflow-runtime"');
    expect(buildScript).toContain('canaryWorkerRoot: "workers/socialflows-runtime-canary"');
    expect(buildScript).toContain("inactive-scaffold");
    expect(runtimeBuildScript).toContain("SOCIALFLOW_RUNTIME_OPENNEXT_BUILD_OK");
    expect(runtimeBuildScript).toContain("forbiddenBuildTokens");
    expect(scaffoldDoc).toContain("SAFE_SHARED_PACKAGE");
    expect(scaffoldDoc).toContain("TEMP_SHARED");
    expect(scaffoldDoc).toContain("FORBIDDEN_SHARED");
    expect(portDoc).toContain("Routes ported into the inactive runtime");
    expect(portDoc).toContain("Temporary shared boundaries");
  });

  it("ports real SocialFlow UI and API routes into the inactive runtime root", () => {
    const requiredPaths = [
      "apps/socialflow-runtime/src/app/socialflow/auth/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/layout.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/profile/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/ai/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/analysis/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/plan/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/sessions/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/setup/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/settings/account/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/settings/billing/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/settings/ownership/page.tsx",
      "apps/socialflow-runtime/src/app/socialflow/(workspace)/settings/team/page.tsx",
      "apps/socialflow-runtime/src/app/api/socialflow/auths/logins/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/auths/logouts/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/auths/registrations/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/campaigns/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/exports/current/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/posts/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/profile/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/ai/generate/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/ai/regenerate/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/linkedin/connect/route.ts",
      "apps/socialflow-runtime/src/app/api/socialflow/linkedin/callback/route.ts",
    ];

    for (const relativePath of requiredPaths) {
      expect(existsSync(path.join(repoRoot, relativePath)), relativePath).toBe(true);
    }
  });
});
