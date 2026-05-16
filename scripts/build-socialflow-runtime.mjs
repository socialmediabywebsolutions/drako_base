import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, "apps", "socialflow-runtime");
const outputDir = path.join(repoRoot, "build", "socialflow-runtime-scaffold");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`COMMAND_FAILED: ${command} ${args.join(" ")}`);
  }
}

async function readJson(absolutePath) {
  return JSON.parse(await fs.readFile(absolutePath, "utf8"));
}

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep searching.
    }
  }

  throw new Error(`PATH_NOT_FOUND: ${candidates.join(" | ")}`);
}

async function listFiles(dir, matcher) {
  const results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await listFiles(absolutePath, matcher));
      continue;
    }
    if (matcher.test(entry.name)) {
      results.push(absolutePath);
    }
  }

  return results;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
}

function extractModuleSpecifiers(source) {
  const matches = source.matchAll(/(?:from\s+["']([^"']+)["'])|(?:import\s+["']([^"']+)["'])/g);
  return Array.from(matches, (match) => match[1] ?? match[2]).filter(Boolean);
}

async function analyzeSourceGraph() {
  const boundariesPath = path.join(runtimeRoot, "runtime-boundaries.json");
  const boundaries = await readJson(boundariesPath);
  const sourceFiles = await listFiles(path.join(runtimeRoot, "src"), /\.(ts|tsx)$/);
  const tempMatchers = boundaries.TEMP_SHARED.map((pattern) => ({
    pattern,
    regex: new RegExp(`^${escapeRegex(pattern)}$`),
  }));
  const safeMatchers = boundaries.SAFE_SHARED_PACKAGE.map((pattern) => ({
    pattern,
    regex: new RegExp(`^${escapeRegex(pattern)}$`),
  }));
  const forbiddenMatchers = boundaries.FORBIDDEN_SHARED.map((pattern) => ({
    pattern,
    regex: new RegExp(`^${escapeRegex(pattern)}$`),
  }));

  let importsScanned = 0;
  const tempSharedHitsByPattern = Object.fromEntries(boundaries.TEMP_SHARED.map((pattern) => [pattern, 0]));
  const safeSharedHitsByPattern = Object.fromEntries(boundaries.SAFE_SHARED_PACKAGE.map((pattern) => [pattern, 0]));
  const forbiddenHitsByPattern = Object.fromEntries(boundaries.FORBIDDEN_SHARED.map((pattern) => [pattern, 0]));
  const crossRuntimeReferences = [];

  for (const file of sourceFiles) {
    const relative = path.relative(runtimeRoot, file).replace(/\\/g, "/");
    const source = await fs.readFile(file, "utf8");
    const specifiers = extractModuleSpecifiers(source);

    for (const specifier of specifiers) {
      importsScanned += 1;
      if (specifier.startsWith("@/")) {
        crossRuntimeReferences.push({ file: relative, specifier });
      }

      for (const matcher of safeMatchers) {
        if (matcher.regex.test(specifier)) {
          safeSharedHitsByPattern[matcher.pattern] += 1;
        }
      }
      for (const matcher of tempMatchers) {
        if (matcher.regex.test(specifier)) {
          tempSharedHitsByPattern[matcher.pattern] += 1;
        }
      }
      for (const matcher of forbiddenMatchers) {
        if (matcher.regex.test(specifier)) {
          forbiddenHitsByPattern[matcher.pattern] += 1;
        }
      }
    }
  }

  return {
    filesScanned: sourceFiles.length,
    importsScanned,
    safeSharedHitsTotal: Object.values(safeSharedHitsByPattern).reduce((total, value) => total + value, 0),
    safeSharedHitsByPattern,
    tempSharedHitsTotal: Object.values(tempSharedHitsByPattern).reduce((total, value) => total + value, 0),
    tempSharedHitsByPattern,
    forbiddenHitsTotal: Object.values(forbiddenHitsByPattern).reduce((total, value) => total + value, 0),
    forbiddenHitsByPattern,
    crossRuntimeReferenceCount: crossRuntimeReferences.length,
    crossRuntimeReferences,
  };
}

async function analyzeRuntimeBuild() {
  const buildRoot = path.join(runtimeRoot, ".open-next");
  const nestedNextRoot = path.join(buildRoot, "server-functions", "default", "apps", "socialflow-runtime", ".next");
  const standaloneNextRoot = path.join(runtimeRoot, ".next");
  const nextRoot = await firstExistingPath([nestedNextRoot, standaloneNextRoot]);
  const appPathsManifestPath = path.join(nextRoot, "server", "app-paths-manifest.json");
  const middlewareManifestPath = path.join(nextRoot, "server", "middleware-manifest.json");
  const buildFiles = await listFiles(buildRoot, /\.(js|json)$/);
  const appPathsManifest = await readJson(appPathsManifestPath);
  const middlewareManifest = await readJson(middlewareManifestPath);
  const sourceGraph = await analyzeSourceGraph();
  const routePaths = Object.keys(appPathsManifest).sort();
  const forbiddenRoutePatterns = [
    /^\/operator(?:\/|$)/,
    /^\/admin(?:\/|$)/,
    /^\/dashboard(?:\/|$)/,
    /^\/campobase(?:\/|$)/,
    /^\/owner(?:\/|$)/,
    /^\/mentoria(?:\/|$)/,
    /^\/products(?:\/|$)/,
    /^\/clients(?:\/|$)/,
    /^\/clinic(?:\/|$)/,
  ];
  const forbiddenBuildTokens = [
    "app/operator/",
    "app/admin/",
    "app/dashboard/",
    "app/campobase/",
    "app/owner/",
    "app/mentoria/",
    "app/products/",
    "app/clients/",
    "app/clinic/",
    "next-auth/react",
    "NextAuthProviders",
    "initializeMentoriaWorkers",
  ];

  const forbiddenRoutes = routePaths.filter((routePath) =>
    forbiddenRoutePatterns.some((pattern) => pattern.test(routePath))
  );

  const contaminatedFiles = [];
  for (const file of buildFiles) {
    const relative = path.relative(buildRoot, file).replace(/\\/g, "/");
    const contents = await fs.readFile(file, "utf8").catch(() => "");
    const hits = forbiddenBuildTokens.filter((token) => contents.includes(token));
    if (hits.length > 0) {
      contaminatedFiles.push({ file: relative, tokens: hits });
    }
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    runtimeRoot: "apps/socialflow-runtime",
    buildRoot: "apps/socialflow-runtime/.open-next",
    nextRoot: path.relative(repoRoot, nextRoot).replace(/\\/g, "/"),
    routes: {
      total: routePaths.length,
      api: routePaths.filter((routePath) => routePath.startsWith("/api/socialflow/")).length,
      ui: routePaths.filter((routePath) => routePath.startsWith("/socialflow")).length,
      paths: routePaths,
      forbiddenMatches: forbiddenRoutes,
    },
    middleware: {
      manifestKeys: Object.keys(middlewareManifest.middleware ?? {}).sort(),
      functionKeys: Object.keys(middlewareManifest.functions ?? {}).sort(),
    },
    sourceGraph,
    buildGraph: {
      filesScanned: buildFiles.length,
      contaminatedFileCount: contaminatedFiles.length,
      contaminatedFiles,
    },
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "runtime-port-audit.json"),
    `${JSON.stringify(audit, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `SOCIALFLOW_RUNTIME_OPENNEXT_BUILD_OK routes=${audit.routes.total} api=${audit.routes.api} ui=${audit.routes.ui} tempSharedHits=${audit.sourceGraph.tempSharedHitsTotal} contaminatedFiles=${audit.buildGraph.contaminatedFileCount}`,
  );
}

run(process.execPath, [path.join(repoRoot, "scripts", "build-socialflow-runtime-scaffold.mjs")]);
run("pnpm", ["--dir", "apps/socialflow-runtime", "exec", "opennextjs-cloudflare", "build"]);
await analyzeRuntimeBuild();
