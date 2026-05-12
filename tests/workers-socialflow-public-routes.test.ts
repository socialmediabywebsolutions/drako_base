import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("socialflow runtime wiring", () => {
  it("wires saas-socialflows-prod to the OpenNext worker runtime", () => {
    const source = read("workers/socialflows/wrangler.workers.toml");

    expect(source).toContain('main = "../../.open-next/socialflows/worker.js"');
    expect(source).toContain('compatibility_flags = ["nodejs_compat"]');
    expect(source).toContain("[assets]");
    expect(source).toContain('directory = "../../.open-next/socialflows/assets"');
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
    const workspaceRuntime = read("src/app/(dashboard)/socialflow/page.tsx");
    const profileRuntime = read("src/app/(dashboard)/socialflow/profile/page.tsx");

    expect(workspaceRuntime).toContain("/api/socialflow/campaigns");
    expect(workspaceRuntime).toContain("/api/socialflow/posts");
    expect(workspaceRuntime).not.toContain("/api/social/");
    expect(profileRuntime).toContain("/api/socialflow/profile");
    expect(profileRuntime).not.toContain("/api/social/");
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

    expect(source).toContain("Verify SocialFlow dedicated artifact");
    expect(source).toContain('grep -q \'export { default } from "../worker.js";\' .open-next/socialflows/worker.js');
    expect(source).toContain('grep -q \'export \\* from "../worker.js";\' .open-next/socialflows/worker.js');
    expect(source).toContain('grep -q \'"productKey": "socialflows"\' .open-next/socialflows/artifact-manifest.json');
    expect(source).toContain('grep -q \'"artifactMode": "dedicated-wrapper"\' .open-next/socialflows/artifact-manifest.json');
    expect(source).toContain('grep -q \'"generatedFrom": ".open-next/worker.js"\' .open-next/socialflows/artifact-manifest.json');
    expect(source).toContain('grep -q \'main = "../../.open-next/socialflows/worker.js"\' workers/socialflows/wrangler.workers.toml');
    expect(source).toContain("SOCIALFLOW_DEDICATED_ARTIFACT_NOT_ACTIVATED");
    expect(source).toContain("SOCIALFLOW_DEDICATED_ARTIFACT_FAKE");
  });

  it("prepares SocialFlow standalone without activating it", () => {
    const matrix = read("docs/config/open-next-artifact-matrix.json");
    const workflow = read(".github/workflows/drako-factory-deploy.yml");
    const wrangler = read("workers/socialflows/wrangler.workers.toml");

    expect(matrix).toContain('"artifactName": "open-next-socialflows-standalone-prepared"');
    expect(matrix).toContain('"artifactMode": "standalone-prepared"');
    expect(matrix).toContain('"activationState": "inactive"');
    expect(matrix).toContain('"deployMode": "not-deployed"');
    expect(matrix).toContain('"workerPath": ".open-next/socialflows-standalone/worker.js"');

    expect(workflow).toContain("Verify SocialFlow standalone prepared artifact (inactive)");
    expect(workflow).toContain("Verify SocialFlow standalone remains inactive");
    expect(workflow).toContain("SOCIALFLOW_STANDALONE_PREPARED_IS_WRAPPER");
    expect(workflow).toContain("SOCIALFLOW_STANDALONE_PREPARED_FAKE");
    expect(workflow).toContain("SOCIALFLOW_STANDALONE_PREMATURE_ACTIVATION");
    expect(workflow).not.toContain("Download SocialFlow standalone prepared artifact");
    expect(workflow).not.toContain("name: open-next-socialflows-standalone-build");

    expect(wrangler).toContain('main = "../../.open-next/socialflows/worker.js"');
    expect(wrangler).toContain('directory = "../../.open-next/socialflows/assets"');
    expect(wrangler).not.toContain("socialflows-standalone");
  });
});
