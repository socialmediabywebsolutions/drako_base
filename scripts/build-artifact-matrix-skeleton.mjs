import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const defaultOutputDir = process.env.ARTIFACT_MATRIX_OUTPUT_DIR || "build/open-next-artifact-matrix";
const configPath = path.resolve(repoRoot, "docs/config/open-next-artifact-matrix.json");

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

async function readWorkerConfig(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  return fs.readFile(absolutePath, "utf8");
}

function requireToken(content, token, message) {
  if (!content.includes(token)) {
    throw new Error(message);
  }
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

  return {
    state: config.state,
    deployMode: config.deployMode,
    deployActiveArtifactName: config.activeArtifact.artifactName,
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
    splitReady: false,
    splitActivated: false,
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
    products: records.map((record) => ({
      productKey: record.productKey,
      workerName: record.workerName,
      wranglerConfigPath: record.wranglerConfigPath,
      currentArtifact: record.currentArtifact,
      plannedArtifact: record.plannedArtifact,
      splitReady: record.splitReady,
      splitActivated: record.splitActivated,
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
