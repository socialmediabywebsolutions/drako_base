import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "build", "socialflow-runtime-scaffold");

const requiredFiles = [
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
];

async function assertFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  await fs.access(absolutePath);
  return absolutePath;
}

async function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  return JSON.parse(await fs.readFile(absolutePath, "utf8"));
}

async function main() {
  await Promise.all(requiredFiles.map(assertFile));

  const boundaries = await readJson("apps/socialflow-runtime/runtime-boundaries.json");
  const wrangler = await fs.readFile(
    path.join(repoRoot, "workers/socialflows-runtime-canary/wrangler.workers.toml"),
    "utf8",
  );

  if (!Array.isArray(boundaries.SAFE_SHARED_PACKAGE) || boundaries.SAFE_SHARED_PACKAGE.length === 0) {
    throw new Error("SOCIALFLOW_RUNTIME_SCAFFOLD_INVALID: SAFE_SHARED_PACKAGE must declare at least one package.");
  }
  if (!Array.isArray(boundaries.TEMP_SHARED)) {
    throw new Error("SOCIALFLOW_RUNTIME_SCAFFOLD_INVALID: TEMP_SHARED must be declared as an array.");
  }
  if (!Array.isArray(boundaries.FORBIDDEN_SHARED) || boundaries.FORBIDDEN_SHARED.length === 0) {
    throw new Error("SOCIALFLOW_RUNTIME_SCAFFOLD_INVALID: FORBIDDEN_SHARED must declare blocked imports.");
  }
  if (wrangler.includes("[[routes]]") || wrangler.includes("custom_domain = true")) {
    throw new Error("SOCIALFLOW_RUNTIME_SCAFFOLD_INVALID: canary wrangler must not define routes or custom domains.");
  }
  if (!wrangler.includes('main = "src/workers.ts"')) {
    throw new Error("SOCIALFLOW_RUNTIME_SCAFFOLD_INVALID: canary wrangler must stay pointed at src/workers.ts.");
  }

  await fs.mkdir(outputDir, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    runtimeRoot: "apps/socialflow-runtime",
    canaryWorkerRoot: "workers/socialflows-runtime-canary",
    requiredFiles,
    packageClassifications: boundaries,
    activationState: "inactive-scaffold",
  };

  await fs.writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(
    `SOCIALFLOW_RUNTIME_SCAFFOLD_BUILD_OK runtimeRoot=${manifest.runtimeRoot} canaryWorkerRoot=${manifest.canaryWorkerRoot} safeShared=${boundaries.SAFE_SHARED_PACKAGE.length} tempShared=${boundaries.TEMP_SHARED.length} forbidden=${boundaries.FORBIDDEN_SHARED.length}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
