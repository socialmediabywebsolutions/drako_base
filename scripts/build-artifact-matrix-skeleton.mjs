import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const defaultOutputDir = process.env.ARTIFACT_MATRIX_OUTPUT_DIR || "build/open-next-artifact-matrix";
const configPath = path.resolve(repoRoot, "docs/config/open-next-artifact-matrix.json");
const artifactWrapperBanner = "// Drako artifact matrix wrapper: generated file, do not edit by hand.\n";
const scopeAuditVersion = 1;
const defaultSocialflowScopeAudit = {
  scopeMode: "standalone-runtime-copy",
  allowedRoutePrefixes: [
    "socialflow",
    "socialflows",
    "api/socialflow",
    "api/socialflows",
    "api/social",
    "auth/linkedin",
  ],
  suspiciousRoutePrefixes: [
    "operator",
    "owner",
    "bases",
    "mentoria",
    "mentorias",
    "campobase",
    "campamento-base",
    "site/panel",
    "api/operator",
    "api/owner",
    "api/bases",
    "api/mentoria",
    "api/mentorias",
    "api/campobase",
    "api/campamento-base",
  ],
};

function parseArgs(argv) {
  const values = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, rawValue] = arg.slice(2).split("=", 2);
    values[key] = rawValue ?? "true";
  }
  return values;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function removeDirIfExists(dirPath) {
  await fs.rm(dirPath, { recursive: true, force: true });
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRelative(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function stripRouteFileSuffix(relativePath) {
  return relativePath
    .replace(/\/page_client-reference-manifest\.js$/, "")
    .replace(/\/layout_client-reference-manifest\.js$/, "")
    .replace(/\/route_client-reference-manifest\.js$/, "")
    .replace(/\/page\.js$/, "")
    .replace(/\/layout\.js$/, "")
    .replace(/\/route\.js$/, "");
}

async function listFilesRecursive(dirPath) {
  const files = [];
  let entries = [];
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return files;
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(absolutePath)));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function routeMatchesPrefix(routePath, prefix) {
  return routePath === prefix || routePath.startsWith(`${prefix}/`);
}

async function buildServerFunctionsScopeAudit(standaloneArtifactRoot, artifact, generatedAt) {
  const scopeAuditConfig = {
    ...defaultSocialflowScopeAudit,
    ...(artifact.scopeAudit ?? {}),
  };
  const serverFunctionsRoot = path.join(standaloneArtifactRoot, "server-functions");
  const appRouteFiles = (await listFilesRecursive(serverFunctionsRoot)).filter((filePath) =>
    normalizeRelative(filePath).includes("/.next/server/app/"),
  );
  const routePaths = Array.from(
    new Set(
      appRouteFiles
        .map((filePath) => {
          const normalized = normalizeRelative(path.relative(serverFunctionsRoot, filePath));
          const appMarker = "/.next/server/app/";
          const markerIndex = normalized.indexOf(appMarker);
          if (markerIndex === -1) return null;
          const routeFilePath = normalized.slice(markerIndex + appMarker.length);
          const routePath = stripRouteFileSuffix(routeFilePath);
          if (!routePath || routePath.startsWith("chunks/") || routePath.includes("/chunks/")) return null;
          return routePath;
        })
        .filter(Boolean),
    ),
  ).sort();

  const suspiciousRoutePrefixes = scopeAuditConfig.suspiciousRoutePrefixes ?? [];
  const allowedRoutePrefixes = scopeAuditConfig.allowedRoutePrefixes ?? [];
  const foreignRoutes = routePaths.filter((routePath) =>
    suspiciousRoutePrefixes.some((prefix) => routeMatchesPrefix(routePath, prefix)),
  );
  const allowedRoutes = routePaths.filter((routePath) =>
    allowedRoutePrefixes.some((prefix) => routeMatchesPrefix(routePath, prefix)),
  );
  const foreignRouteHits = Array.from(
    new Set(
      foreignRoutes.flatMap((routePath) =>
        suspiciousRoutePrefixes.filter((prefix) => routeMatchesPrefix(routePath, prefix)),
      ),
    ),
  ).sort();

  return {
    product: artifact.key,
    runtimeMode: artifact.sourceRuntime ?? "open-next-runtime-copy",
    scopeMode: scopeAuditConfig.scopeMode,
    scopeAuditVersion,
    scopeAuditGeneratedAt: generatedAt,
    serverFunctionsPath: normalizeRelative(path.relative(repoRoot, serverFunctionsRoot)),
    routeCount: routePaths.length,
    allowedRouteCount: allowedRoutes.length,
    containsForeignRoutes: foreignRoutes.length > 0,
    foreignRouteHits,
    foreignRouteCount: foreignRoutes.length,
    foreignRouteExamples: foreignRoutes.slice(0, 50),
    scopedReady: foreignRoutes.length === 0,
  };
}

async function copyDir(sourceDir, targetDir) {
  await removeDirIfExists(targetDir);
  await ensureDir(path.dirname(targetDir));
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

async function copyOpenNextRuntimeSubset(sourceRoot, targetRoot) {
  await removeDirIfExists(targetRoot);
  await ensureDir(targetRoot);

  const excludedEntries = new Set([
    "bases",
    "drakos",
    "mentorias",
    "socialflows",
    "socialflows-standalone",
  ]);

  for (const entry of await fs.readdir(sourceRoot, { withFileTypes: true })) {
    if (excludedEntries.has(entry.name)) continue;

    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      await fs.cp(sourcePath, targetPath, { recursive: true });
    } else if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
    }
  }
}

async function readWorkerConfig(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  return fs.readFile(absolutePath, "utf8");
}

function requireToken(content, token, message) {
  if (!content.includes(token)) {
    throw new Error(message);
  }
}

async function emitDedicatedWrapperArtifact(config, product) {
  const plannedWorkerAbsolute = path.resolve(repoRoot, product.plannedWorkerPath);
  const plannedAssetsAbsolute = path.resolve(repoRoot, product.plannedAssetsPath);
  const plannedArtifactRoot = path.dirname(plannedWorkerAbsolute);
  const globalWorkerRelativeFromWrapper = normalizeRelative(path.relative(plannedArtifactRoot, path.resolve(repoRoot, config.activeArtifact.workerPath)));
  const globalAssetsAbsolute = path.resolve(repoRoot, config.activeArtifact.assetsPath);

  await ensureDir(plannedArtifactRoot);
  const wrapperSource = `${artifactWrapperBanner}export { default } from "${globalWorkerRelativeFromWrapper}";\nexport * from "${globalWorkerRelativeFromWrapper}";\n`;
  await fs.writeFile(plannedWorkerAbsolute, wrapperSource, "utf8");
  await copyDir(globalAssetsAbsolute, plannedAssetsAbsolute);
  await fs.writeFile(
    path.join(plannedArtifactRoot, "artifact-manifest.json"),
    `${JSON.stringify(
      {
        productKey: product.key,
        artifactMode: product.artifactMode,
        artifactState: product.artifactState ?? null,
        dedicatedArtifactName: product.dedicatedArtifactName ?? null,
        preparedArtifactName: product.preparedArtifactName ?? null,
        generatedFrom: normalizeRelative(config.activeArtifact.workerPath),
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function emitStandaloneArtifact(config, artifact) {
  const standaloneWorkerAbsolute = path.resolve(repoRoot, artifact.workerPath);
  const standaloneArtifactRoot = path.dirname(standaloneWorkerAbsolute);
  const activeArtifactRoot = path.dirname(path.resolve(repoRoot, config.activeArtifact.workerPath));
  const artifactState = artifact.artifactState ?? artifact.state ?? null;
  const generatedAt = new Date().toISOString();

  await copyOpenNextRuntimeSubset(activeArtifactRoot, standaloneArtifactRoot);

  const manifest = {
    productKey: artifact.key,
    artifactMode: artifact.artifactMode,
    artifactState,
    standaloneArtifactName:
      artifact.artifactMode === "standalone" ? artifact.artifactName : artifact.standaloneArtifactName ?? null,
    preparedArtifactName:
      artifact.artifactMode === "standalone-prepared" ? artifact.artifactName : artifact.preparedArtifactName ?? null,
    activationState: artifact.activationState ?? null,
    deployMode: artifact.deployMode ?? null,
    sourceArtifactName: artifact.sourceArtifactName ?? config.activeArtifact.artifactName,
    sourceRuntime: artifact.sourceRuntime ?? "open-next-runtime-copy",
    generatedAt,
  };

  if (artifact.key === "socialflows") {
    const scopeAudit = await buildServerFunctionsScopeAudit(standaloneArtifactRoot, artifact, generatedAt);
    Object.assign(manifest, {
      scopeMode: scopeAudit.scopeMode,
      containsForeignRoutes: scopeAudit.containsForeignRoutes,
      foreignRouteHits: scopeAudit.foreignRouteHits,
      foreignRouteCount: scopeAudit.foreignRouteCount,
      scopeAuditVersion: scopeAudit.scopeAuditVersion,
      scopeAuditGeneratedAt: scopeAudit.scopeAuditGeneratedAt,
      scopedReady: scopeAudit.scopedReady,
    });
    await fs.writeFile(path.join(standaloneArtifactRoot, "scope-audit.json"), `${JSON.stringify(scopeAudit, null, 2)}\n`, "utf8");
  }

  await fs.writeFile(path.join(standaloneArtifactRoot, "artifact-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function buildSkeletonRecord(config, product) {
  const workerConfigContent = await readWorkerConfig(product.wranglerConfigPath);
  requireToken(
    workerConfigContent,
    `main = "${product.currentWranglerMain}"`,
    `ARTIFACT_MATRIX_SKELETON_INVALID: ${product.wranglerConfigPath} no longer points to ${product.currentWranglerMain}`,
  );
  requireToken(
    workerConfigContent,
    `directory = "${product.currentWranglerAssetsDirectory}"`,
    `ARTIFACT_MATRIX_SKELETON_INVALID: ${product.wranglerConfigPath} no longer points assets to ${product.currentWranglerAssetsDirectory}`,
  );

  const plannedWorkerAbsolute = path.resolve(repoRoot, product.plannedWorkerPath);
  const plannedAssetsAbsolute = path.resolve(repoRoot, product.plannedAssetsPath);
  const activeWorkerAbsolute = path.resolve(repoRoot, config.activeArtifact.workerPath);
  const activeAssetsAbsolute = path.resolve(repoRoot, config.activeArtifact.assetsPath);
  const standaloneArtifact = [...(config.standaloneArtifacts ?? []), ...(config.preparedArtifacts ?? [])].find(
    (artifact) => artifact.key === product.key,
  );
  const standaloneWorkerAbsolute = standaloneArtifact?.workerPath
    ? path.resolve(repoRoot, standaloneArtifact.workerPath)
    : null;
  const standaloneAssetsAbsolute = standaloneArtifact?.assetsPath
    ? path.resolve(repoRoot, standaloneArtifact.assetsPath)
    : null;

  const shouldGenerateDedicatedRuntime =
    (product.artifactMode === "dedicated-wrapper" || product.artifactMode === "prepared-wrapper") &&
    (await fileExists(activeWorkerAbsolute)) &&
    (await fileExists(activeAssetsAbsolute));

  if (shouldGenerateDedicatedRuntime) {
    await emitDedicatedWrapperArtifact(config, product);
  }

  const shouldGenerateStandaloneRuntime =
    (standaloneArtifact?.artifactMode === "standalone" || standaloneArtifact?.artifactMode === "standalone-prepared") &&
    (await fileExists(activeWorkerAbsolute)) &&
    (await fileExists(activeAssetsAbsolute));

  if (shouldGenerateStandaloneRuntime) {
    await emitStandaloneArtifact(config, standaloneArtifact);
  }

  return {
    state: config.state,
    deployMode: config.deployMode,
    deployActiveArtifactName: config.activeArtifact.artifactName,
    artifactMode: product.artifactMode,
    artifactState: product.artifactState ?? null,
    productKey: product.key,
    workerName: product.workerName,
    wranglerConfigPath: normalizeRelative(product.wranglerConfigPath),
    currentArtifact: {
      workerPath: normalizeRelative(config.activeArtifact.workerPath),
      assetsPath: normalizeRelative(config.activeArtifact.assetsPath),
      exists: {
        worker: await fileExists(activeWorkerAbsolute),
        assets: await fileExists(activeAssetsAbsolute),
      },
    },
    plannedArtifact: {
      workerPath: normalizeRelative(product.plannedWorkerPath),
      assetsPath: normalizeRelative(product.plannedAssetsPath),
      exists: {
        worker: await fileExists(plannedWorkerAbsolute),
        assets: await fileExists(plannedAssetsAbsolute),
      },
    },
    standaloneArtifact: standaloneArtifact
      ? {
          artifactMode: standaloneArtifact.artifactMode,
          artifactState: standaloneArtifact.artifactState ?? standaloneArtifact.state ?? null,
          activationState: standaloneArtifact.activationState ?? null,
          deployMode: standaloneArtifact.deployMode ?? null,
          artifactName: standaloneArtifact.artifactName,
          workerPath: normalizeRelative(standaloneArtifact.workerPath),
          assetsPath: normalizeRelative(standaloneArtifact.assetsPath),
          exists: {
            worker: standaloneWorkerAbsolute ? await fileExists(standaloneWorkerAbsolute) : false,
            assets: standaloneAssetsAbsolute ? await fileExists(standaloneAssetsAbsolute) : false,
          },
        }
      : null,
    splitReady:
      product.artifactMode === "dedicated-wrapper" || product.artifactMode === "prepared-wrapper"
        ? shouldGenerateDedicatedRuntime
        : product.artifactMode === "standalone-runtime"
          ? shouldGenerateStandaloneRuntime
          : false,
    splitActivated: product.artifactMode === "dedicated-wrapper" || product.artifactMode === "standalone-runtime",
    dedicatedArtifactName: product.dedicatedArtifactName ?? null,
    preparedArtifactName: product.preparedArtifactName ?? null,
    standaloneArtifactName: product.standaloneArtifactName ?? null,
    notes: config.notes,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readJson(configPath);
  const selectedProduct = process.env.ARTIFACT_MATRIX_PRODUCT || args.product || "all";
  const requireGlobalBuild =
    (process.env.ARTIFACT_MATRIX_REQUIRE_GLOBAL_BUILD || args["require-global-build"] || "0") === "1";
  const outputDir = path.resolve(repoRoot, process.env.ARTIFACT_MATRIX_OUTPUT_DIR || args["output-dir"] || defaultOutputDir);

  const availableProducts = new Map(config.products.map((product) => [product.key, product]));
  const products =
    selectedProduct === "all"
      ? config.products
      : [availableProducts.get(selectedProduct)].filter(Boolean);

  if (products.length === 0) {
    throw new Error(
      `ARTIFACT_MATRIX_SKELETON_UNKNOWN_PRODUCT: ${selectedProduct}. Expected one of ${Array.from(availableProducts.keys()).join(", ")}`,
    );
  }

  await ensureDir(outputDir);
  const records = [];
  for (const product of products) {
    const record = await buildSkeletonRecord(config, product);
    if (requireGlobalBuild && !record.currentArtifact.exists.worker) {
      throw new Error(
        `ARTIFACT_MATRIX_SKELETON_GLOBAL_BUILD_MISSING: expected ${record.currentArtifact.workerPath} before requiring the build artifact`,
      );
    }
    records.push(record);
    const outputPath = path.join(outputDir, `${product.key}.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }

  const indexPayload = {
    state: config.state,
    deployMode: config.deployMode,
    deployActiveArtifactName: config.activeArtifact.artifactName,
    dedicatedArtifacts: config.dedicatedArtifacts ?? [],
    preparedArtifacts: config.preparedArtifacts ?? [],
    standaloneArtifacts: config.standaloneArtifacts ?? [],
    products: records.map((record) => ({
      artifactMode: record.artifactMode,
      artifactState: record.artifactState,
      productKey: record.productKey,
      workerName: record.workerName,
      wranglerConfigPath: record.wranglerConfigPath,
      currentArtifact: record.currentArtifact,
      plannedArtifact: record.plannedArtifact,
      standaloneArtifact: record.standaloneArtifact,
      splitReady: record.splitReady,
      splitActivated: record.splitActivated,
      dedicatedArtifactName: record.dedicatedArtifactName,
      preparedArtifactName: record.preparedArtifactName,
      standaloneArtifactName: record.standaloneArtifactName,
    })),
  };

  await fs.writeFile(path.join(outputDir, "index.json"), `${JSON.stringify(indexPayload, null, 2)}\n`, "utf8");
  console.log(
    `ARTIFACT_MATRIX_SKELETON_OK products=${records.map((record) => record.productKey).join(",")} output=${normalizeRelative(path.relative(repoRoot, outputDir))}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
