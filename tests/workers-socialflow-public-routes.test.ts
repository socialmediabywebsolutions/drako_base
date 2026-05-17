import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("socialflow runtime wiring", () => {
  it("wires saas-socialflows-prod to the standalone OpenNext worker runtime", () => {
    const source = read("workers/socialflows/wrangler.workers.toml");

    expect(source).toContain('main = "../../.open-next/socialflows-standalone/worker.js"');
    expect(source).toContain('compatibility_flags = ["nodejs_compat"]');
    expect(source).toContain("[assets]");
    expect(source).toContain('directory = "../../.open-next/socialflows-standalone/assets"');
    expect(source).not.toContain('main = "../../.open-next/socialflows/worker.js"');
    expect(source).toContain('pattern = "socialflow.drako.systems"');
    expect(source).toContain('pattern = "socialflows.drako.systems"');
  });

  it("keeps the legacy worker entrypoint fail-closed", () => {
    const source = read("workers/socialflows/src/workers.ts");

    expect(source).toContain("SOCIALFLOW_RUNTIME_MISWIRED");
    expect(source).not.toContain("createWorkersHandlers");
    expect(source).not.toContain("success: true");
  });

  it("removes fake shared SocialFlow handlers from runtime dispatch", () => {
    const source = read("packages/shared/workers-handlers/index.ts");

    expect(source).not.toContain('case "socialflows"');
    expect(source).not.toContain('case "saas-socialflows-prod"');
    expect(source).not.toContain('success: true, worker: "socialflows"');
  });

  it("serves the authenticated workspace from real app routes", () => {
    const workspaceRuntime = read("src/app/socialflow/(workspace)/page.tsx");
    const profileRuntime = read("src/app/(dashboard)/socialflow/profile/page.tsx");
    const legacyWorkspacePageExists = existsSync(path.join(repoRoot, "src/app/(dashboard)/socialflow/page.tsx"));

    expect(workspaceRuntime).toContain("/api/socialflow/campaigns");
    expect(workspaceRuntime).toContain("/api/socialflow/posts");
    expect(workspaceRuntime).not.toContain("/api/social/");
    expect(profileRuntime).toContain("/api/socialflow/profile");
    expect(profileRuntime).not.toContain("/api/social/");
    expect(legacyWorkspacePageExists).toBe(false);
  });

  it("keeps the socialflow layout detached from DRACO_DB and legacy shells", () => {
    const source = read("src/app/socialflow/(workspace)/layout.tsx");

    expect(source).not.toContain("DRACO_DB");
    expect(source).not.toContain("@/modules/socialflow-app/layout");
    expect(source).toContain("Isolated product runtime");
  });

  it("keeps isolated runtime pages away from Mentoria and Campamento Base", () => {
    const files = [
      "src/app/socialflow/(workspace)/analysis/page.tsx",
      "src/app/socialflow/(workspace)/plan/page.tsx",
      "src/app/socialflow/(workspace)/setup/page.tsx",
      "src/app/socialflow/(workspace)/sessions/page.tsx",
      "src/app/socialflow/(workspace)/settings/billing/page.tsx",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source).not.toMatch(/@\/components\/mentoria/);
      expect(source).not.toMatch(/@\/lib\/auth\/campamento-core/);
      expect(source).not.toContain("/api/mentoria/");
    }
  });

  it("keeps the canonical smoke strict about runtime truthfulness", () => {
    const source = read("scripts/smoke/socialflow-canonical-domain-smoke.mjs");

    expect(source).toContain("/api/socialflow/profile");
    expect(source).toContain("/api/socialflow/campaigns?saasId=socialflow");
    expect(source).toContain("/api/socialflow/posts?saasId=socialflow");
    expect(source).toContain("placeholder token detected");
    expect(source).not.toContain("405");
  });

  it("keeps the CI artifact lane strict for SocialFlow", () => {
    const source = read(".github/workflows/drako-factory-deploy.yml");

    expect(source).toContain("Verify SocialFlow standalone active artifact");
    expect(source).toContain("Verify SocialFlow standalone runtime active");
    expect(source).toContain("name: open-next-socialflows-standalone-build");
    expect(source).toContain('grep -q \'"productKey": "socialflows"\' .open-next/socialflows-standalone/artifact-manifest.json');
    expect(source).toContain('grep -q \'"artifactMode": "standalone"\' .open-next/socialflows-standalone/artifact-manifest.json');
    expect(source).toContain('grep -q \'"artifactState": "active"\' .open-next/socialflows-standalone/artifact-manifest.json');
    expect(source).toContain('grep -q \'"standaloneArtifactName": "open-next-socialflows-standalone-build"\' .open-next/socialflows-standalone/artifact-manifest.json');
    expect(source).toContain('grep -q \'main = "../../.open-next/socialflows-standalone/worker.js"\' workers/socialflows/wrangler.workers.toml');
    expect(source).toContain("SOCIALFLOW_STANDALONE_WRAPPER_REGRESSION");
    expect(source).toContain("SOCIALFLOW_STANDALONE_GENERATED_FROM_GLOBAL");
    expect(source).toContain("SOCIALFLOW_STANDALONE_NOT_ACTIVATED");
    expect(source).toContain("SOCIALFLOW_STANDALONE_ARTIFACT_FAKE");
    expect(source).toContain("max_attempts=3");
    expect(source).toContain("wrangler-socialflow-deploy-attempt-${attempt}.log");
    expect(source).toContain("assets-upload-session");
    expect(source).toContain("code:[[:space:]]*10013");
    expect(source).toContain("TRANSIENT_SOCIALFLOW_ASSETS_UPLOAD_SESSION_FAILURE");
    expect(source).toContain("SocialFlow deploy failed with non-retryable error on attempt ${attempt}/${max_attempts}.");
    expect(source).not.toContain("wrangler deploy -c wrangler.workers.toml || true");
  });

  it("activates SocialFlow standalone without falling back to wrapper metadata", () => {
    const matrix = read("docs/config/open-next-artifact-matrix.json");
    const workflow = read(".github/workflows/drako-factory-deploy.yml");
    const wrangler = read("workers/socialflows/wrangler.workers.toml");

    expect(matrix).toContain('"artifactName": "open-next-socialflows-standalone-build"');
    expect(matrix).toContain('"artifactMode": "standalone"');
    expect(matrix).toContain('"artifactState": "active"');
    expect(matrix).toContain('"artifactMode": "standalone-runtime"');
    expect(matrix).toContain('"workerPath": ".open-next/socialflows-standalone/worker.js"');
    expect(matrix).not.toContain('"generatedFrom": ".open-next/worker.js"');

    expect(workflow).toContain("Verify SocialFlow standalone active artifact");
    expect(workflow).toContain("Verify SocialFlow standalone runtime active");
    expect(workflow).toContain("SOCIALFLOW_STANDALONE_WRAPPER_REGRESSION");
    expect(workflow).toContain("SOCIALFLOW_STANDALONE_ARTIFACT_FAKE");
    expect(workflow).toContain("name: open-next-socialflows-standalone-build");
    expect(workflow).not.toContain("Verify SocialFlow standalone prepared artifact (inactive)");
    expect(workflow).not.toContain("Verify SocialFlow standalone remains inactive");

    expect(wrangler).toContain('main = "../../.open-next/socialflows-standalone/worker.js"');
    expect(wrangler).toContain('directory = "../../.open-next/socialflows-standalone/assets"');
    expect(wrangler).not.toContain('main = "../../.open-next/socialflows/worker.js"');
  });
});
