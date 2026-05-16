import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const runtimeRoot = path.join(repoRoot, "apps", "socialflow-runtime");
const outputDir = path.join(repoRoot, "build", "socialflow-runtime-scaffold");
const runtimeContractPath = path.join(runtimeRoot, "runtime-deploy-contract.json");

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

function sumValues(record) {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

function parseWranglerBindingBlocks(source, sectionName) {
  const blocks = source.match(new RegExp(`\\[\\[${escapeRegex(sectionName)}\\]\\][\\s\\S]*?(?=\\n\\[\\[|\\n\\[|$)`, "g")) ?? [];
  return blocks.map((block) => {
    const binding = block.match(/binding\s*=\s*"([^"]+)"/)?.[1] ?? null;
    const queue = block.match(/queue\s*=\s*"([^"]+)"/)?.[1] ?? null;
    const service = block.match(/service\s*=\s*"([^"]+)"/)?.[1] ?? null;
    return { binding, queue, service, block };
  });
}

function parseWranglerVars(source) {
  const block = source.match(/\[vars\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? "";
  const matches = block.matchAll(/^([A-Z0-9_]+)\s*=\s*/gm);
  return Array.from(matches, (match) => match[1]);
}

function parseWranglerState(source) {
  return {
    workerName: source.match(/^name\s*=\s*"([^"]+)"/m)?.[1] ?? null,
    main: source.match(/^main\s*=\s*"([^"]+)"/m)?.[1] ?? null,
    workersDev: source.match(/^workers_dev\s*=\s*(true|false)/m)?.[1] ?? null,
    hasAssets: /\[assets\]/.test(source),
    hasRoutes: /\[\[routes\]\]/.test(source),
    hasCustomDomain: /custom_domain\s*=\s*true/.test(source),
    d1Bindings: parseWranglerBindingBlocks(source, "d1_databases").map((entry) => entry.binding).filter(Boolean),
    kvBindings: parseWranglerBindingBlocks(source, "kv_namespaces").map((entry) => entry.binding).filter(Boolean),
    r2Bindings: parseWranglerBindingBlocks(source, "r2_buckets").map((entry) => entry.binding).filter(Boolean),
    queueBindings: parseWranglerBindingBlocks(source, "queues.producers").map((entry) => entry.binding).filter(Boolean),
    serviceBindings: parseWranglerBindingBlocks(source, "services").map((entry) => entry.binding).filter(Boolean),
    vars: parseWranglerVars(source),
  };
}

function parseNamedJsonExport(source, name) {
  const match = source.match(new RegExp(`export const ${name} = (\\{[\\s\\S]*?\\});`));
  if (!match) {
    throw new Error(`SOCIALFLOW_RUNTIME_NEXT_ENV_INVALID: missing export ${name}`);
  }
  return JSON.parse(match[1]);
}

function pickAllowedEnvSurface(input, allowedKeys) {
  const filtered = {};
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      filtered[key] = input[key];
    }
  }
  return filtered;
}

async function sanitizeOpenNextEnvSurface(buildRoot, contract) {
  const nextEnvPath = path.join(buildRoot, "cloudflare", "next-env.mjs");
  const source = await fs.readFile(nextEnvPath, "utf8").catch(() => null);
  if (!source) {
    return {
      file: null,
      beforeKeyCount: 0,
      afterKeyCount: 0,
      removedKeys: [],
      allowedKeys: contract.buildEnvAllowlist,
    };
  }

  const production = parseNamedJsonExport(source, "production");
  const development = parseNamedJsonExport(source, "development");
  const beforeKeys = Array.from(new Set([...Object.keys(production), ...Object.keys(development)])).sort();
  const filteredProduction = pickAllowedEnvSurface(production, contract.buildEnvAllowlist);
  const filteredDevelopment = pickAllowedEnvSurface(development, contract.buildEnvAllowlist);
  const afterKeys = Array.from(new Set([...Object.keys(filteredProduction), ...Object.keys(filteredDevelopment)])).sort();
  const removedKeys = beforeKeys.filter((key) => !afterKeys.includes(key));

  const sanitizedSource = [
    `export const production = ${JSON.stringify(filteredProduction)};`,
    `export const development = ${JSON.stringify(filteredDevelopment)};`,
    "",
  ].join("\n");

  await fs.writeFile(nextEnvPath, sanitizedSource, "utf8");

  return {
    file: path.relative(repoRoot, nextEnvPath).replace(/\\/g, "/"),
    beforeKeyCount: beforeKeys.length,
    afterKeyCount: afterKeys.length,
    removedKeys,
    allowedKeys: contract.buildEnvAllowlist,
  };
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
  const processEnvReferences = [];

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

    const processEnvHits = Array.from(source.matchAll(/process\.env\.([A-Z0-9_]+)/g), (match) => match[1]);
    if (processEnvHits.length > 0) {
      processEnvReferences.push({ file: relative, keys: processEnvHits });
    }
  }

  return {
    filesScanned: sourceFiles.length,
    importsScanned,
    safeSharedHitsTotal: sumValues(safeSharedHitsByPattern),
    safeSharedHitsByPattern,
    tempSharedHitsTotal: sumValues(tempSharedHitsByPattern),
    tempSharedHitsByPattern,
    forbiddenHitsTotal: sumValues(forbiddenHitsByPattern),
    forbiddenHitsByPattern,
    crossRuntimeReferenceCount: crossRuntimeReferences.length,
    crossRuntimeReferences,
    processEnvReferenceCount: processEnvReferences.length,
    processEnvReferences,
  };
}

function buildBindingCoverage(contract, runtimeWrangler) {
  const requiredVars = contract.runtimeVars.required;
  const coverageByType = {
    d1: {
      required: contract.bindings.d1,
      declared: runtimeWrangler.d1Bindings,
      missing: contract.bindings.d1.filter((binding) => !runtimeWrangler.d1Bindings.includes(binding)),
    },
    kv: {
      required: contract.bindings.kv,
      declared: runtimeWrangler.kvBindings,
      missing: contract.bindings.kv.filter((binding) => !runtimeWrangler.kvBindings.includes(binding)),
    },
    r2: {
      required: contract.bindings.r2,
      declared: runtimeWrangler.r2Bindings,
      missing: contract.bindings.r2.filter((binding) => !runtimeWrangler.r2Bindings.includes(binding)),
    },
    queues: {
      required: contract.bindings.queues,
      declared: runtimeWrangler.queueBindings,
      missing: contract.bindings.queues.filter((binding) => !runtimeWrangler.queueBindings.includes(binding)),
    },
    services: {
      required: contract.bindings.services,
      declared: runtimeWrangler.serviceBindings,
      missing: contract.bindings.services.filter((binding) => !runtimeWrangler.serviceBindings.includes(binding)),
    },
    vars: {
      required: requiredVars,
      declared: runtimeWrangler.vars,
      missing: requiredVars.filter((binding) => !runtimeWrangler.vars.includes(binding)),
    },
  };

  return {
    coverageByType,
    requiredBindingSlots:
      contract.bindings.d1.length
      + contract.bindings.kv.length
      + contract.bindings.r2.length
      + contract.bindings.queues.length
      + contract.bindings.services.length
      + requiredVars.length,
    declaredBindingSlots:
      runtimeWrangler.d1Bindings.filter((binding) => contract.bindings.d1.includes(binding)).length
      + runtimeWrangler.kvBindings.filter((binding) => contract.bindings.kv.includes(binding)).length
      + runtimeWrangler.r2Bindings.filter((binding) => contract.bindings.r2.includes(binding)).length
      + runtimeWrangler.queueBindings.filter((binding) => contract.bindings.queues.includes(binding)).length
      + runtimeWrangler.serviceBindings.filter((binding) => contract.bindings.services.includes(binding)).length
      + runtimeWrangler.vars.filter((binding) => requiredVars.includes(binding)).length,
  };
}

function buildWorkerIdentityAudit(contract, scaffoldWrangler, runtimeWrangler) {
  return {
    distinctNames: scaffoldWrangler.workerName !== runtimeWrangler.workerName,
    scaffoldWorker: scaffoldWrangler,
    deployableWorker: runtimeWrangler,
    expected: contract.workerIdentities,
  };
}

function buildDeployBlockers(params) {
  const blockers = [];

  if (!params.workerIdentity.distinctNames) {
    blockers.push("worker-name-collision");
  }
  if (params.bindingCoverage.coverageByType.d1.missing.length > 0) {
    blockers.push("missing-d1-bindings");
  }
  if (params.bindingCoverage.coverageByType.vars.missing.length > 0) {
    blockers.push("missing-runtime-vars");
  }
  if (!params.workerIdentity.deployableWorker.hasAssets) {
    blockers.push("missing-assets-binding");
  }
  if (params.envSurface.afterKeyCount > params.envSurface.allowedKeys.length) {
    blockers.push("env-surface-exceeds-allowlist");
  }
  if (params.sourceGraph.processEnvReferences.some((entry) => !entry.file.endsWith("runtime-env.ts"))) {
    blockers.push("unexpected-process-env-usage");
  }
  if (params.workerIdentity.deployableWorker.hasRoutes || params.workerIdentity.deployableWorker.hasCustomDomain) {
    blockers.push("deployable-runtime-exposes-traffic-surface");
  }

  return blockers;
}

function buildRollbackBlockers(params) {
  const blockers = [];

  if (!params.workerIdentity.distinctNames) {
    blockers.push("rollback-target-ambiguous");
  }
  if (params.workerIdentity.scaffoldWorker.hasRoutes || params.workerIdentity.scaffoldWorker.hasCustomDomain) {
    blockers.push("scaffold-not-inert");
  }
  if (params.workerIdentity.deployableWorker.workerName !== params.contract.workerIdentities.deployable.workerName) {
    blockers.push("deployable-worker-identity-drift");
  }

  return blockers;
}

async function analyzeRuntimeBuild() {
  const contract = await readJson(runtimeContractPath);
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

  const scaffoldWranglerSource = await fs.readFile(path.join(repoRoot, "workers", "socialflows-runtime-canary", "wrangler.workers.toml"), "utf8");
  const runtimeWranglerSource = await fs.readFile(path.join(runtimeRoot, "wrangler.toml"), "utf8");
  const scaffoldWrangler = parseWranglerState(scaffoldWranglerSource);
  const runtimeWrangler = parseWranglerState(runtimeWranglerSource);
  const envSurface = await sanitizeOpenNextEnvSurface(buildRoot, contract);
  const bindingCoverage = buildBindingCoverage(contract, runtimeWrangler);
  const workerIdentity = buildWorkerIdentityAudit(contract, scaffoldWrangler, runtimeWrangler);
  const deployBlockers = buildDeployBlockers({ workerIdentity, bindingCoverage, envSurface, sourceGraph });
  const rollbackBlockers = buildRollbackBlockers({ workerIdentity, contract });

  const audit = {
    generatedAt: new Date().toISOString(),
    runtimeRoot: "apps/socialflow-runtime",
    buildRoot: "apps/socialflow-runtime/.open-next",
    nextRoot: path.relative(repoRoot, nextRoot).replace(/\\/g, "/"),
    contractVersion: contract.contractVersion,
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
    workerIdentity,
    bindingCoverage,
    envSurface,
    deployBlockers,
    rollbackBlockers,
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, "runtime-port-audit.json"),
    `${JSON.stringify(audit, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(outputDir, "deploy-readiness-audit.json"),
    `${JSON.stringify({
      generatedAt: audit.generatedAt,
      contractVersion: audit.contractVersion,
      workerIdentity: audit.workerIdentity,
      bindingCoverage: audit.bindingCoverage,
      envSurface: audit.envSurface,
      deployBlockers: audit.deployBlockers,
      rollbackBlockers: audit.rollbackBlockers,
    }, null, 2)}\n`,
    "utf8",
  );

  console.log(
    `SOCIALFLOW_RUNTIME_OPENNEXT_BUILD_OK routes=${audit.routes.total} api=${audit.routes.api} ui=${audit.routes.ui} tempSharedHits=${audit.sourceGraph.tempSharedHitsTotal} contaminatedFiles=${audit.buildGraph.contaminatedFileCount} deployBlockers=${audit.deployBlockers.length} rollbackBlockers=${audit.rollbackBlockers.length} envSurface=${audit.envSurface.afterKeyCount}`,
  );
}

run(process.execPath, [path.join(repoRoot, "scripts", "build-socialflow-runtime-scaffold.mjs")]);
run("pnpm", ["--dir", "apps/socialflow-runtime", "exec", "opennextjs-cloudflare", "build"]);
await analyzeRuntimeBuild();
