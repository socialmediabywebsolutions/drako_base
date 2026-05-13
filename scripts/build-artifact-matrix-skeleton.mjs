import { promises as fs } from "node:fs";
import * as fsSync from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const defaultOutputDir = process.env.ARTIFACT_MATRIX_OUTPUT_DIR || "build/open-next-artifact-matrix";
const configPath = path.resolve(repoRoot, "docs/config/open-next-artifact-matrix.json");
const artifactWrapperBanner = "// Drako artifact matrix wrapper: generated file, do not edit by hand.\n";
const scopeAuditVersion = 1;
const productScopedPreviewFilterVersion = 1;
const productScopedRuntimeAuditVersion = 1;
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
const defaultSocialflowProductScopedPreviewFilter = {
  scopeMode: "product-scoped-preview",
  removedRoutePrefixes: [
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
const socialflowRuntimeAuditAllowedSocialflowPrefixes = [
  "socialflow",
  "socialflows",
  "products/socialflow",
  "api/socialflow",
  "api/socialflows",
  "api/social",
  "auth/linkedin",
];
const socialflowRuntimeAuditAllowedRuntimeRoutes = [
  "_not-found",
  "favicon.ico",
  "page.js",
  "page_client-reference-manifest.js",
];
const socialflowRuntimeAuditAllowedInfraPrefixes = [
  "api/health",
  "api/stripe",
  "api/webhooks/stripe",
  "billing/success",
  "billing/cancel",
];
const socialflowRuntimeAuditForbiddenRoutePrefixes = [
  "operator",
  "owner",
  "bases",
  "campobase",
  "campamento-base",
  "mentoria",
  "mentorias",
  "drakos",
  "parent",
  "api/operator",
  "api/owner",
  "api/bases",
  "api/campobase",
  "api/campamento-base",
  "api/mentoria",
  "api/mentorias",
  "api/drakos",
  "api/parent",
  "site/mentoria",
  "site/mentoria-ar",
  "site/mentoria-cl",
  "site/mentoria-co",
  "site/mentoria-es",
  "site/mentoria-mx",
  "(dashboard)/campamento-base",
  "(dashboard)/campobase",
  "(dashboard)/parent",
];
const socialflowRuntimeAuditSuspiciousRoutePrefixes = [
  "(dashboard)",
  "[locale]",
  "about",
  "admin",
  "agents",
  "alerts",
  "api/agents",
  "api/ai",
  "api/analysis",
  "api/analytics",
  "api/appointments",
  "api/auth",
  "api/bi",
  "api/billing",
  "api/blueprints",
  "api/branding",
  "api/catalog",
  "api/checkout",
  "api/client-saas",
  "api/clients",
  "api/clinic",
  "api/companies",
  "api/company",
  "api/contact",
  "api/conversation",
  "api/core",
  "api/cron",
  "api/customer",
  "api/customers",
  "api/departments",
  "api/dev-architects",
  "api/domains",
  "api/economy",
  "api/email-intake",
  "api/employees",
  "api/events",
  "api/factory",
  "api/families",
  "api/features",
  "api/grants",
  "api/inbox",
  "api/internal",
  "api/invites",
  "api/invoices",
  "api/knowledge",
  "api/metrics",
  "api/notifications",
  "api/onboarding",
  "api/orchestrator",
  "api/owners",
  "api/packs",
  "api/projects",
  "api/provision",
  "api/provisioning",
  "api/reports",
  "api/research",
  "api/saas",
  "api/saas-agents",
  "api/site",
  "api/students",
  "api/summaries",
  "api/tasks",
  "api/templates",
  "api/tenants",
  "api/tickets",
  "api/whatsapp",
  "auth",
  "billing",
  "clients",
  "clinic",
  "companies",
  "contact",
  "dashboard",
  "departments",
  "dev-architects",
  "grants",
  "inbox",
  "journal",
  "metrics",
  "preview",
  "products",
  "profile",
  "public",
  "site",
  "staff",
  "system",
  "vision",
];
const socialflowRuntimeAuditForbiddenReferenceRules = [
  {
    product: "operator",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?operator(?:\/|\.|$)|\/api\/operator(?:\/|\b)|["']\/operator(?:\/|["'])|@\/(?:components|lib)\/operator)/i,
  },
  {
    product: "owner",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?owner(?:\/|\.|$)|\/api\/owner(?:\/|\b)|["']\/owner(?:\/|["'])|@\/(?:components|lib)\/owner)/i,
  },
  {
    product: "mentoria",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?mentoria(?:\/|\.|$)|\/api\/mentoria(?:\/|\b)|["']\/(?:site\/)?mentoria(?:\/|["'])|@\/(?:components|lib)\/mentoria|MENTORIA_DB|MENTORIA_LEGACY)/i,
  },
  {
    product: "mentorias",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?mentorias(?:\/|\.|$)|\/api\/mentorias(?:\/|\b)|["']\/mentorias(?:\/|["'])|MENTORIAS_AUTHS_DB)/i,
  },
  {
    product: "bases",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?bases(?:\/|\.|$)|\/api\/bases(?:\/|\b)|["']\/bases(?:\/|["'])|BASES_AUTHS_DB|BASE_OPERATOR_AUTH_ONLY)/i,
  },
  {
    product: "campobase",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?campobase(?:\/|\.|$)|\/api\/campobase(?:\/|\b)|["']\/campobase(?:\/|["'])|@\/lib\/campobase)/i,
  },
  {
    product: "campamento-base",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?campamento-base(?:\/|\.|$)|\/api\/campamento-base(?:\/|\b)|["']\/campamento-base(?:\/|["'])|@\/lib\/campamento-base)/i,
  },
  {
    product: "drakos",
    pattern: /(?:\/src\/(?:app|lib|modules|components)\/(?:api\/)?drakos(?:\/|\.|$)|\/api\/drakos(?:\/|\b)|["']\/drakos(?:\/|["'])|DRAKOS_AUTHS_DB)/i,
  },
  {
    product: "parent",
    pattern: /(?:\/src\/app\/\(dashboard\)\/parent(?:\/|\.|$)|\/api\/parent(?:\/|\b)|["']\/parent(?:\/|["']))/i,
  },
];
const socialflowRuntimeAuditSharedInfraReferenceRules = [
  { token: "DRACO_DB", pattern: /\bDRACO_DB\b/ },
  { token: "SAASES_DB", pattern: /\bSAASES_DB\b/ },
  { token: "SOCIAL_DB", pattern: /\bSOCIAL_DB\b/ },
  { token: "NEXTAUTH", pattern: /\bNEXTAUTH(?:_SECRET|_URL)?\b/ },
  { token: "STRIPE", pattern: /\bSTRIPE_(?:SECRET_KEY|WEBHOOK_SECRET)\b/ },
  { token: "GLOBAL_LAYOUT", pattern: /\/src\/app\/layout\.(?:ts|tsx|js|jsx)/ },
];

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

async function listServerFunctionAppRoutes(serverFunctionsRoot) {
  const appRouteFiles = (await listFilesRecursive(serverFunctionsRoot)).filter((filePath) =>
    normalizeRelative(filePath).includes("/.next/server/app/"),
  );
  return Array.from(
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
}

async function buildServerFunctionsScopeAudit(standaloneArtifactRoot, artifact, generatedAt, overrides = {}) {
  const scopeAuditConfig = {
    ...defaultSocialflowScopeAudit,
    ...(artifact.scopeAudit ?? {}),
    ...overrides,
  };
  const serverFunctionsRoot = path.join(standaloneArtifactRoot, "server-functions");
  const routePaths = await listServerFunctionAppRoutes(serverFunctionsRoot);

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

function routeFromManifestKey(manifestKey) {
  return String(manifestKey)
    .replace(/^\//, "")
    .replace(/\/(page|layout|route)$/, "");
}

function manifestKeyMatchesRoutePrefixes(manifestKey, prefixes) {
  const routePath = routeFromManifestKey(manifestKey);
  return prefixes.some((prefix) => routeMatchesPrefix(routePath, prefix));
}

async function pruneJsonObjectManifest(filePath, shouldRemoveKey) {
  if (!(await fileExists(filePath))) {
    return { removed: 0, remaining: 0 };
  }
  const manifest = await readJson(filePath);
  let removed = 0;
  for (const key of Object.keys(manifest)) {
    if (shouldRemoveKey(key)) {
      delete manifest[key];
      removed += 1;
    }
  }
  await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { removed, remaining: Object.keys(manifest).length };
}

async function pruneFunctionsConfigManifest(filePath, shouldRemoveKey) {
  if (!(await fileExists(filePath))) {
    return { removed: 0, remaining: 0 };
  }
  const manifest = await readJson(filePath);
  const functions = manifest.functions && typeof manifest.functions === "object" ? manifest.functions : {};
  let removed = 0;
  for (const key of Object.keys(functions)) {
    if (shouldRemoveKey(key)) {
      delete functions[key];
      removed += 1;
    }
  }
  manifest.functions = functions;
  await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return { removed, remaining: Object.keys(functions).length };
}

async function pruneServerReferenceManifestJson(filePath, removedPrefixes) {
  if (!(await fileExists(filePath))) {
    return { removed: 0, remaining: 0 };
  }
  const manifest = await readJson(filePath);
  let removed = 0;
  for (const runtimeKey of ["node", "edge"]) {
    const runtime = manifest[runtimeKey];
    if (!runtime || typeof runtime !== "object") continue;
    for (const actionId of Object.keys(runtime)) {
      const action = runtime[actionId];
      for (const sectionName of ["workers", "layer"]) {
        const section = action?.[sectionName];
        if (!section || typeof section !== "object") continue;
        for (const key of Object.keys(section)) {
          const appRoute = key.replace(/^app\//, "").replace(/\/(page|layout|route)$/, "");
          if (removedPrefixes.some((prefix) => routeMatchesPrefix(appRoute, prefix))) {
            delete section[key];
            removed += 1;
          }
        }
      }
      const workers = action?.workers && typeof action.workers === "object" ? action.workers : {};
      const layer = action?.layer && typeof action.layer === "object" ? action.layer : {};
      if (Object.keys(workers).length === 0 && Object.keys(layer).length === 0) {
        delete runtime[actionId];
      }
    }
  }
  await fs.writeFile(filePath, `${JSON.stringify(manifest)}\n`, "utf8");
  const remaining = Object.values(manifest.node ?? {}).length + Object.values(manifest.edge ?? {}).length;
  return { removed, remaining };
}

async function pruneServerReferenceManifestJs(filePath, removedPrefixes) {
  if (!(await fileExists(filePath))) {
    return { removed: 0, remaining: 0 };
  }
  const content = await fs.readFile(filePath, "utf8");
  const prefix = 'self.__RSC_SERVER_MANIFEST="';
  if (!content.startsWith(prefix) || !content.endsWith('"\n') && !content.endsWith('"')) {
    return { removed: 0, remaining: 0, warning: "server-reference-manifest.js format not recognized" };
  }
  const rawJsonString = content.slice(prefix.length).replace(/";?\s*$/, "");
  const manifest = JSON.parse(JSON.parse(`"${rawJsonString}"`));
  const before = JSON.stringify(manifest);
  const jsonPath = filePath.replace(/\.js$/, ".json");
  await fs.writeFile(jsonPath, `${JSON.stringify(manifest)}\n`, "utf8");
  const result = await pruneServerReferenceManifestJson(jsonPath, removedPrefixes);
  const prunedManifest = await readJson(jsonPath);
  const serialized = JSON.stringify(JSON.stringify(prunedManifest));
  await fs.writeFile(filePath, `self.__RSC_SERVER_MANIFEST=${serialized}\n`, "utf8");
  return { ...result, changed: before !== JSON.stringify(prunedManifest) };
}

async function readTextIfExists(filePath) {
  if (!(await fileExists(filePath))) return "";
  return fs.readFile(filePath, "utf8");
}

async function validateProductScopedPreviewRuntime(previewRoot, removedPrefixes) {
  const unresolvedDependencies = [];
  const filteringWarnings = [];
  const workerPath = path.join(previewRoot, "worker.js");
  const assetsPath = path.join(previewRoot, "assets");
  const serverFunctionsRoot = path.join(previewRoot, "server-functions");
  const buildPath = path.join(previewRoot, ".build");
  const serverRoot = path.join(serverFunctionsRoot, "default/.next/server");
  const appRoot = path.join(serverRoot, "app");

  for (const [label, targetPath] of [
    ["worker.js", workerPath],
    ["assets", assetsPath],
    ["server-functions", serverFunctionsRoot],
    [".build", buildPath],
  ]) {
    if (!(await fileExists(targetPath))) {
      unresolvedDependencies.push(`missing ${label} at ${normalizeRelative(path.relative(repoRoot, targetPath))}`);
    }
  }

  const workerSource = await readTextIfExists(workerPath);
  if (workerSource.includes('export { default } from') || workerSource.includes("export * from")) {
    unresolvedDependencies.push("worker.js still looks like a wrapper/reexport");
  }
  if (workerSource.includes("../worker.js") || workerSource.includes(".open-next/worker.js")) {
    unresolvedDependencies.push("worker.js references the global OpenNext worker");
  }
  if (!workerSource.includes("./server-functions/default/handler.mjs")) {
    unresolvedDependencies.push("worker.js does not reference the local server-functions/default handler");
  }

  const appPathsManifestPath = path.join(serverRoot, "app-paths-manifest.json");
  const appPathsManifest = (await fileExists(appPathsManifestPath)) ? await readJson(appPathsManifestPath) : {};
  for (const [key, relativeFile] of Object.entries(appPathsManifest)) {
    if (manifestKeyMatchesRoutePrefixes(key, removedPrefixes)) {
      unresolvedDependencies.push(`app-paths-manifest still references removed route ${key}`);
    }
    const absoluteFile = path.join(serverRoot, String(relativeFile));
    if (!(await fileExists(absoluteFile))) {
      unresolvedDependencies.push(`app-paths-manifest missing file ${key} -> ${String(relativeFile)}`);
    }
  }

  const remainingRoutes = await listServerFunctionAppRoutes(serverFunctionsRoot);
  for (const routePath of remainingRoutes) {
    if (removedPrefixes.some((prefix) => routeMatchesPrefix(routePath, prefix))) {
      unresolvedDependencies.push(`removed route file still exists ${routePath}`);
    }
  }

  const middlewareManifestPath = path.join(serverRoot, "middleware-manifest.json");
  if (await fileExists(middlewareManifestPath)) {
    const middlewareManifest = await readJson(middlewareManifestPath);
    for (const middleware of Object.values(middlewareManifest.middleware ?? {})) {
      for (const filePath of middleware.files ?? []) {
        const absoluteFile = path.join(path.dirname(serverRoot), String(filePath));
        if (!(await fileExists(absoluteFile))) {
          filteringWarnings.push(`middleware-manifest references ${String(filePath)}; file is absent in the source standalone runtime too`);
        }
      }
    }
  } else {
    filteringWarnings.push("middleware-manifest.json not found in preview");
  }

  if (!(await fileExists(appRoot))) {
    unresolvedDependencies.push("preview app server directory is missing");
  }

  return {
    runtimeIntegrity: unresolvedDependencies.length === 0,
    unresolvedDependencies,
    filteringWarnings,
  };
}

function routeMatchesAnyPrefix(routePath, prefixes) {
  return prefixes.some((prefix) => routeMatchesPrefix(routePath, prefix));
}

function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}

function extractChunkIds(content) {
  const chunkIds = new Set();
  for (const match of content.matchAll(/\.X\(0,\[([^\]]*)\]/g)) {
    for (const rawChunkId of match[1].split(",")) {
      const chunkId = rawChunkId.trim();
      if (/^\d+$/.test(chunkId)) {
        chunkIds.add(chunkId);
      }
    }
  }
  return Array.from(chunkIds).sort((a, b) => Number(a) - Number(b));
}

function extractSourcePaths(content) {
  const sourcePaths = new Set();
  for (const match of content.matchAll(/"([^"]*\/src\/[^"]+\.(?:ts|tsx|js|jsx))"/g)) {
    sourcePaths.add(normalizeRelative(match[1]));
  }
  for (const match of content.matchAll(/resolvedPagePath:"([^"]+)"/g)) {
    sourcePaths.add(normalizeRelative(match[1]));
  }
  return Array.from(sourcePaths).sort();
}

function extractImportReferences(content) {
  const imports = new Set();
  for (const match of content.matchAll(/\b(?:require|import)\((["'`])([^"'`]+)\1\)/g)) {
    imports.add(match[2]);
  }
  for (const match of content.matchAll(/\bfrom\s+(["'])([^"']+)\1/g)) {
    imports.add(match[2]);
  }
  return Array.from(imports).sort();
}

function extractDynamicImportExpressions(content) {
  const expressions = new Set();
  for (const match of content.matchAll(/\bimport\(([^)]{1,180})\)/g)) {
    expressions.add(match[1].trim());
  }
  return Array.from(expressions).sort();
}

function detectForbiddenProducts(content, sourcePaths = []) {
  const haystack = `${sourcePaths.join("\n")}\n${content}`;
  return socialflowRuntimeAuditForbiddenReferenceRules
    .filter((rule) => rule.pattern.test(haystack))
    .map((rule) => rule.product)
    .sort();
}

function detectSharedInfraTokens(content, sourcePaths = []) {
  const haystack = `${sourcePaths.join("\n")}\n${content}`;
  return socialflowRuntimeAuditSharedInfraReferenceRules
    .filter((rule) => rule.pattern.test(haystack))
    .map((rule) => rule.token)
    .sort();
}

function detectForbiddenProductsInRoutePath(routePath) {
  return socialflowRuntimeAuditForbiddenRoutePrefixes
    .filter((prefix) => routeMatchesPrefix(routePath, prefix))
    .map((prefix) => prefix.split("/")[1] ?? prefix.split("/")[0])
    .map((product) => product.replace(/^\(dashboard\)$/, "dashboard"))
    .sort();
}

function splitRouteFilesForRuntimeAudit(routePath, appRoot, serverRoot, appPathEntries) {
  const executableFiles = new Set(appPathEntries.map((entry) => path.join(serverRoot, entry.relativeFile)));
  const manifestFiles = new Set();
  const routeRoot = path.join(appRoot, routePath);

  if (fileExistsSync(routeRoot)) {
    const stat = fsSyncStat(routeRoot);
    if (stat.isDirectory()) {
      for (const filePath of listFilesRecursiveSync(routeRoot)) {
        const relative = normalizeRelative(path.relative(routeRoot, filePath));
        if (/^(page|layout|route)\.js$/.test(relative)) {
          executableFiles.add(filePath);
        } else if (/^(page|layout|route)_client-reference-manifest\.js$/.test(relative)) {
          manifestFiles.add(filePath);
        }
      }
    } else if (/_client-reference-manifest\.js$/.test(routeRoot)) {
      manifestFiles.add(routeRoot);
    } else {
      executableFiles.add(routeRoot);
    }
  }

  for (const executableFile of Array.from(executableFiles)) {
    const clientReferenceManifest = executableFile.replace(/\.js$/, "_client-reference-manifest.js");
    if (fileExistsSync(clientReferenceManifest)) {
      manifestFiles.add(clientReferenceManifest);
    }
  }

  return {
    executableFiles: Array.from(executableFiles).filter(fileExistsSync).sort(),
    manifestFiles: Array.from(manifestFiles).filter(fileExistsSync).sort(),
  };
}

function fileExistsSync(filePath) {
  try {
    return fsSyncStat(filePath).isFile() || fsSyncStat(filePath).isDirectory();
  } catch {
    return false;
  }
}

function fsSyncStat(filePath) {
  return fsSync.statSync(filePath);
}

function listFilesRecursiveSync(dirPath) {
  const stat = fsSyncStat(dirPath);
  if (stat.isFile()) return [dirPath];

  const files = [];
  for (const entry of fsSync.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursiveSync(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }
  return files;
}

function classifyRuntimeAuditRoute(params) {
  const routePathProducts = detectForbiddenProductsInRoutePath(params.routePath);
  const executableProducts = uniqueSorted([
    ...detectForbiddenProducts(params.executableContent, params.executableSourcePaths),
  ]);
  const manifestProducts = uniqueSorted([
    ...detectForbiddenProducts(params.manifestContent, params.manifestSourcePaths),
  ]);
  const sharedChunkProducts = uniqueSorted([
    ...detectForbiddenProducts(params.sharedChunkContent, params.sharedChunkSourcePaths),
  ]);
  const sharedInfraTokens = uniqueSorted([
    ...detectSharedInfraTokens(params.executableContent, params.executableSourcePaths),
    ...detectSharedInfraTokens(params.manifestContent, params.manifestSourcePaths),
    ...detectSharedInfraTokens(params.sharedChunkContent, params.sharedChunkSourcePaths),
  ]);
  const reasons = [];

  if (routePathProducts.length > 0) {
    reasons.push(`route path matches forbidden product surface: ${routePathProducts.join(",")}`);
  }
  if (executableProducts.length > 0) {
    reasons.push(`executable bundle references foreign product tokens: ${executableProducts.join(",")}`);
  }
  if (manifestProducts.length > 0) {
    reasons.push(`client/server manifests retain foreign product references: ${manifestProducts.join(",")}`);
  }
  if (sharedChunkProducts.length > 0) {
    reasons.push(`shared chunks carry foreign product references: ${sharedChunkProducts.join(",")}`);
  }
  if (sharedInfraTokens.length > 0) {
    reasons.push(`shared infra tokens observed: ${sharedInfraTokens.join(",")}`);
  }

  let category = "UNKNOWN";
  if (socialflowRuntimeAuditAllowedRuntimeRoutes.includes(params.routePath)) {
    category = "ALLOWED_SHARED_RUNTIME";
  } else if (routePathProducts.length > 0 || executableProducts.length > 0) {
    category = "CROSS_PRODUCT_LEAK";
  } else if (routeMatchesAnyPrefix(params.routePath, socialflowRuntimeAuditAllowedSocialflowPrefixes)) {
    category = "ALLOWED_SOCIALFLOW";
  } else if (routeMatchesAnyPrefix(params.routePath, socialflowRuntimeAuditAllowedInfraPrefixes)) {
    category = "ALLOWED_SHARED_INFRA";
  } else if (
    routeMatchesAnyPrefix(params.routePath, socialflowRuntimeAuditSuspiciousRoutePrefixes) ||
    manifestProducts.length > 0 ||
    sharedChunkProducts.length > 0
  ) {
    category = "SUSPICIOUS_SHARED_SURFACE";
  }

  if (category === "UNKNOWN") {
    reasons.push("no deterministic SocialFlow, shared-runtime, shared-infra or monolith rule matched");
  }

  return {
    category,
    routePathProducts,
    executableProducts,
    manifestProducts,
    sharedChunkProducts,
    sharedInfraTokens,
    reasons,
  };
}

function countByCategory(routeClassifications) {
  const counts = {
    ALLOWED_SHARED_RUNTIME: 0,
    ALLOWED_SHARED_INFRA: 0,
    ALLOWED_SOCIALFLOW: 0,
    SUSPICIOUS_SHARED_SURFACE: 0,
    CROSS_PRODUCT_LEAK: 0,
    UNKNOWN: 0,
  };

  for (const route of routeClassifications) {
    counts[route.category] = (counts[route.category] ?? 0) + 1;
  }

  return counts;
}

function buildRuntimeRiskScore(params) {
  return Math.min(
    100,
    params.crossProductLeaks * 4 +
      params.suspiciousRoutes +
      params.unknownRoutes * 2 +
      params.dangerousSharedDependencies * 2 +
      params.manifestCrossProductReferences +
      params.middlewareWarnings * 2 +
      (params.runtimeIntegrity ? 0 : 25) +
      params.driftFindings * 10,
  );
}

async function buildSocialflowProductScopedRuntimeAudit(previewRoot, previewArtifact, filterReport, scopeAudit, generatedAt) {
  const serverFunctionsRoot = path.join(previewRoot, "server-functions");
  const serverRoot = path.join(serverFunctionsRoot, "default/.next/server");
  const appRoot = path.join(serverRoot, "app");
  const chunksRoot = path.join(serverRoot, "chunks");
  const routePaths = await listServerFunctionAppRoutes(serverFunctionsRoot);
  const appPathsManifestPath = path.join(serverRoot, "app-paths-manifest.json");
  const appPathsManifest = (await fileExists(appPathsManifestPath)) ? await readJson(appPathsManifestPath) : {};
  const appPathEntriesByRoute = new Map();

  for (const [manifestKey, relativeFile] of Object.entries(appPathsManifest)) {
    const routePath = routeFromManifestKey(manifestKey);
    if (!appPathEntriesByRoute.has(routePath)) {
      appPathEntriesByRoute.set(routePath, []);
    }
    appPathEntriesByRoute.get(routePath).push({
      manifestKey,
      relativeFile: normalizeRelative(String(relativeFile)),
    });
  }

  const routeClassifications = [];
  const dangerousSharedDependencyMap = new Map();
  const dynamicImportReferences = new Set();
  const relativeImportReferences = new Set();

  for (const routePath of routePaths) {
    const appPathEntries = appPathEntriesByRoute.get(routePath) ?? [];
    const routeFiles = splitRouteFilesForRuntimeAudit(routePath, appRoot, serverRoot, appPathEntries);
    const executableContents = [];
    const manifestContents = [];
    const chunkContents = [];
    const chunkIds = new Set();

    for (const filePath of routeFiles.executableFiles) {
      const content = await readTextIfExists(filePath);
      executableContents.push(content);
      for (const chunkId of extractChunkIds(content)) {
        chunkIds.add(chunkId);
      }
      for (const reference of extractImportReferences(content)) {
        if (reference.startsWith(".")) relativeImportReferences.add(reference);
      }
      for (const reference of extractDynamicImportExpressions(content)) {
        dynamicImportReferences.add(reference);
      }
    }

    for (const filePath of routeFiles.manifestFiles) {
      manifestContents.push(await readTextIfExists(filePath));
    }

    for (const chunkId of Array.from(chunkIds).sort((a, b) => Number(a) - Number(b))) {
      const chunkPath = path.join(chunksRoot, `${chunkId}.js`);
      const content = await readTextIfExists(chunkPath);
      if (!content) continue;
      chunkContents.push(content);
      const products = detectForbiddenProducts(content, extractSourcePaths(content));
      const sharedInfraTokens = detectSharedInfraTokens(content, extractSourcePaths(content));
      if (products.length > 0 || sharedInfraTokens.length > 0) {
        const existing = dangerousSharedDependencyMap.get(chunkId) ?? {
          chunkId,
          filePath: normalizeRelative(path.relative(previewRoot, chunkPath)),
          products: new Set(),
          sharedInfraTokens: new Set(),
          referencedBy: new Set(),
        };
        for (const product of products) existing.products.add(product);
        for (const token of sharedInfraTokens) existing.sharedInfraTokens.add(token);
        existing.referencedBy.add(routePath);
        dangerousSharedDependencyMap.set(chunkId, existing);
      }
      for (const reference of extractDynamicImportExpressions(content)) {
        dynamicImportReferences.add(reference);
      }
    }

    const executableContent = executableContents.join("\n");
    const manifestContent = manifestContents.join("\n");
    const sharedChunkContent = chunkContents.join("\n");
    const executableSourcePaths = extractSourcePaths(executableContent);
    const manifestSourcePaths = extractSourcePaths(manifestContent);
    const sharedChunkSourcePaths = extractSourcePaths(sharedChunkContent);
    const classification = classifyRuntimeAuditRoute({
      routePath,
      executableContent,
      manifestContent,
      sharedChunkContent,
      executableSourcePaths,
      manifestSourcePaths,
      sharedChunkSourcePaths,
    });

    routeClassifications.push({
      routePath,
      category: classification.category,
      reasons: classification.reasons,
      routeType: routePath.startsWith("api/") ? "api_route" : routePath.includes("route") ? "route_artifact" : "app_route",
      files: {
        executable: routeFiles.executableFiles.map((filePath) => normalizeRelative(path.relative(previewRoot, filePath))),
        manifests: routeFiles.manifestFiles.map((filePath) => normalizeRelative(path.relative(previewRoot, filePath))),
      },
      appPathManifestKeys: appPathEntries.map((entry) => entry.manifestKey).sort(),
      sourcePaths: {
        executable: executableSourcePaths.slice(0, 25),
        manifests: manifestSourcePaths.slice(0, 25),
        sharedChunks: sharedChunkSourcePaths.slice(0, 25),
      },
      chunkIds: Array.from(chunkIds).sort((a, b) => Number(a) - Number(b)),
      referenceHits: {
        routePathProducts: classification.routePathProducts,
        executableProducts: classification.executableProducts,
        manifestProducts: classification.manifestProducts,
        sharedChunkProducts: classification.sharedChunkProducts,
        sharedInfraTokens: classification.sharedInfraTokens,
      },
    });
  }

  const categoryCounts = countByCategory(routeClassifications);
  const allowedRoutes =
    categoryCounts.ALLOWED_SHARED_RUNTIME + categoryCounts.ALLOWED_SHARED_INFRA + categoryCounts.ALLOWED_SOCIALFLOW;
  const suspiciousRoutes = categoryCounts.SUSPICIOUS_SHARED_SURFACE;
  const crossProductLeaks = categoryCounts.CROSS_PRODUCT_LEAK;
  const unknownRoutes = categoryCounts.UNKNOWN;
  const sharedInfraRoutes = categoryCounts.ALLOWED_SHARED_INFRA;
  const routeSet = new Set(routePaths);
  const filterReportRoutes = Array.isArray(filterReport.remainingRoutes) ? filterReport.remainingRoutes : [];
  const filterReportRouteSet = new Set(filterReportRoutes);
  const routesMissingFromFilterReport = routePaths.filter((routePath) => !filterReportRouteSet.has(routePath));
  const filterReportRoutesMissingFromFilesystem = filterReportRoutes.filter((routePath) => !routeSet.has(routePath));
  const appPathRouteSet = new Set(Array.from(appPathEntriesByRoute.keys()));
  const filesystemRoutesMissingFromAppPathsManifest = routePaths.filter((routePath) => !appPathRouteSet.has(routePath));
  const appPathRoutesMissingFromFilesystem = Array.from(appPathRouteSet)
    .filter((routePath) => !routeSet.has(routePath))
    .filter((routePath) => !(routePath === "page" && routeSet.has("page.js")))
    .sort();
  const middlewareManifestPath = path.join(serverRoot, "middleware-manifest.json");
  const middlewareReferences = [];
  const middlewareWarnings = [];

  if (await fileExists(middlewareManifestPath)) {
    const middlewareManifest = await readJson(middlewareManifestPath);
    for (const middleware of Object.values(middlewareManifest.middleware ?? {})) {
      for (const filePath of middleware.files ?? []) {
        const absoluteFile = path.join(path.dirname(serverRoot), String(filePath));
        const exists = await fileExists(absoluteFile);
        middlewareReferences.push({
          filePath: String(filePath),
          exists,
        });
        if (!exists) {
          middlewareWarnings.push(`middleware-manifest references missing ${String(filePath)}`);
        }
      }
    }
  } else {
    middlewareWarnings.push("middleware-manifest.json not found in preview");
  }

  const dangerousSharedDependencies = Array.from(dangerousSharedDependencyMap.values())
    .map((dependency) => ({
      chunkId: dependency.chunkId,
      filePath: dependency.filePath,
      products: Array.from(dependency.products).sort(),
      sharedInfraTokens: Array.from(dependency.sharedInfraTokens).sort(),
      referencedByCount: dependency.referencedBy.size,
      referencedByExamples: Array.from(dependency.referencedBy).sort().slice(0, 20),
    }))
    .sort((a, b) => b.referencedByCount - a.referencedByCount || Number(a.chunkId) - Number(b.chunkId));

  const manifestCrossProductReferences = routeClassifications.filter(
    (route) => route.referenceHits.manifestProducts.length > 0,
  ).length;
  const driftFindings = [
    ...routesMissingFromFilterReport.map((routePath) => `filesystem route missing from filter-report: ${routePath}`),
    ...filterReportRoutesMissingFromFilesystem.map((routePath) => `filter-report route missing from filesystem: ${routePath}`),
    ...appPathRoutesMissingFromFilesystem.map((routePath) => `app-paths-manifest route missing from filesystem: ${routePath}`),
  ];
  const blockingFindings = [];
  const warnings = [
    ...middlewareWarnings,
    ...(Array.isArray(filterReport.filteringWarnings) ? filterReport.filteringWarnings : []),
  ];

  if (crossProductLeaks > 0) {
    blockingFindings.push(`${crossProductLeaks} routes classified as CROSS_PRODUCT_LEAK`);
  }
  if (suspiciousRoutes > 0) {
    blockingFindings.push(`${suspiciousRoutes} routes classified as SUSPICIOUS_SHARED_SURFACE`);
  }
  if (unknownRoutes > 0) {
    blockingFindings.push(`${unknownRoutes} routes classified as UNKNOWN`);
  }
  if (driftFindings.length > 0) {
    blockingFindings.push(`${driftFindings.length} route inventory drift findings`);
  }
  if (filterReport.runtimeIntegrity !== true) {
    blockingFindings.push("filter-report runtimeIntegrity is not true");
  }
  if (dangerousSharedDependencies.length > 0) {
    warnings.push(`${dangerousSharedDependencies.length} shared chunks carry cross-product or shared-infra references`);
  }
  if (manifestCrossProductReferences > 0) {
    warnings.push(`${manifestCrossProductReferences} route client-reference manifests retain cross-product source references`);
  }

  const runtimeRiskScore = buildRuntimeRiskScore({
    crossProductLeaks,
    suspiciousRoutes,
    unknownRoutes,
    dangerousSharedDependencies: dangerousSharedDependencies.length,
    manifestCrossProductReferences,
    middlewareWarnings: middlewareWarnings.length,
    runtimeIntegrity: filterReport.runtimeIntegrity === true,
    driftFindings: driftFindings.length,
  });
  const scopedActivationReady =
    filterReport.runtimeIntegrity === true &&
    runtimeRiskScore === 0 &&
    blockingFindings.length === 0 &&
    dangerousSharedDependencies.length === 0;

  return {
    product: previewArtifact.key,
    artifactMode: previewArtifact.artifactMode,
    artifactState: previewArtifact.artifactState,
    derivedFrom: previewArtifact.derivedFrom,
    previewArtifactPath: normalizeRelative(path.relative(repoRoot, previewRoot)),
    runtimeAuditVersion: productScopedRuntimeAuditVersion,
    runtimeAuditGeneratedAt: generatedAt,
    totalRoutes: routeClassifications.length,
    allowedRoutes,
    suspiciousRoutes,
    crossProductLeaks,
    unknownRoutes,
    sharedInfraRoutes,
    runtimeRiskScore,
    scopedActivationReady,
    blockingFindings,
    warnings: uniqueSorted(warnings),
    categoryCounts,
    inventory: {
      serverFunctionsPath: normalizeRelative(path.relative(repoRoot, serverFunctionsRoot)),
      appPathManifestRouteCount: appPathEntriesByRoute.size,
      filterReportRemainingCount: filterReport.remainingCount,
      scopeAuditRouteCount: scopeAudit.routeCount,
      routeHandlers: routeClassifications.filter((route) => route.routeType === "api_route").length,
      appRoutes: routeClassifications.filter((route) => route.routeType === "app_route").length,
      routesMissingFromFilterReport,
      filterReportRoutesMissingFromFilesystem,
      filesystemRoutesMissingFromAppPathsManifest,
      appPathRoutesMissingFromFilesystem,
    },
    importGraph: {
      dynamicImportReferences: Array.from(dynamicImportReferences).sort().slice(0, 100),
      relativeImportReferences: Array.from(relativeImportReferences).sort().slice(0, 100),
      middlewareReferences,
      dangerousSharedDependencies,
    },
    crossProductLeakRoutes: routeClassifications.filter((route) => route.category === "CROSS_PRODUCT_LEAK"),
    suspiciousRouteDetails: routeClassifications.filter((route) => route.category === "SUSPICIOUS_SHARED_SURFACE"),
    unknownRouteDetails: routeClassifications.filter((route) => route.category === "UNKNOWN"),
    routeClassifications,
  };
}

async function emitSocialflowProductScopedPreviewArtifact(standaloneArtifact, previewArtifact) {
  const sourceRoot = path.dirname(path.resolve(repoRoot, standaloneArtifact.workerPath));
  const previewRoot = path.dirname(path.resolve(repoRoot, previewArtifact.workerPath));
  const generatedAt = new Date().toISOString();
  const filterConfig = {
    ...defaultSocialflowProductScopedPreviewFilter,
    ...(previewArtifact.filter ?? {}),
  };
  const removedRoutePrefixes = filterConfig.removedRoutePrefixes;

  await copyDir(sourceRoot, previewRoot);

  const serverFunctionsRoot = path.join(previewRoot, "server-functions");
  const serverRoot = path.join(serverFunctionsRoot, "default/.next/server");
  const appRoot = path.join(serverRoot, "app");
  const originalRoutes = await listServerFunctionAppRoutes(serverFunctionsRoot);
  const removedRoutes = originalRoutes.filter((routePath) =>
    removedRoutePrefixes.some((prefix) => routeMatchesPrefix(routePath, prefix)),
  );

  for (const routePath of removedRoutes) {
    await fs.rm(path.join(appRoot, routePath), { recursive: true, force: true });
  }

  const manifestPruneResults = {
    appPathsManifest: await pruneJsonObjectManifest(path.join(serverRoot, "app-paths-manifest.json"), (key) =>
      manifestKeyMatchesRoutePrefixes(key, removedRoutePrefixes),
    ),
    functionsConfigManifest: await pruneFunctionsConfigManifest(path.join(serverRoot, "functions-config-manifest.json"), (key) =>
      manifestKeyMatchesRoutePrefixes(key, removedRoutePrefixes),
    ),
    serverReferenceManifestJson: await pruneServerReferenceManifestJson(
      path.join(serverRoot, "server-reference-manifest.json"),
      removedRoutePrefixes,
    ),
    serverReferenceManifestJs: await pruneServerReferenceManifestJs(
      path.join(serverRoot, "server-reference-manifest.js"),
      removedRoutePrefixes,
    ),
  };

  const remainingRoutes = await listServerFunctionAppRoutes(serverFunctionsRoot);
  const integrity = await validateProductScopedPreviewRuntime(previewRoot, removedRoutePrefixes);
  const filterReport = {
    product: previewArtifact.key,
    artifactMode: previewArtifact.artifactMode,
    artifactState: previewArtifact.artifactState,
    derivedFrom: previewArtifact.derivedFrom,
    sourceArtifactPath: normalizeRelative(path.relative(repoRoot, sourceRoot)),
    previewArtifactPath: normalizeRelative(path.relative(repoRoot, previewRoot)),
    filterVersion: productScopedPreviewFilterVersion,
    filterGeneratedAt: generatedAt,
    removedRoutePrefixes,
    removedRoutes,
    removedCount: removedRoutes.length,
    remainingRoutes,
    remainingCount: remainingRoutes.length,
    manifestPruneResults,
    runtimeIntegrity: integrity.runtimeIntegrity,
    unresolvedDependencies: integrity.unresolvedDependencies,
    filteringWarnings: integrity.filteringWarnings,
  };

  const scopeAudit = await buildServerFunctionsScopeAudit(
    previewRoot,
    {
      key: previewArtifact.key,
      sourceRuntime: previewArtifact.sourceRuntime ?? "product-scoped-preview-copy",
      scopeAudit: {
        ...(standaloneArtifact.scopeAudit ?? {}),
        scopeMode: filterConfig.scopeMode,
      },
    },
    generatedAt,
  );
  const runtimeAudit = await buildSocialflowProductScopedRuntimeAudit(
    previewRoot,
    previewArtifact,
    filterReport,
    scopeAudit,
    generatedAt,
  );

  const manifest = {
    productKey: previewArtifact.key,
    artifactMode: previewArtifact.artifactMode,
    artifactState: previewArtifact.artifactState,
    derivedFrom: previewArtifact.derivedFrom,
    sourceArtifactName: standaloneArtifact.artifactName,
    sourceArtifactPath: normalizeRelative(path.relative(repoRoot, sourceRoot)),
    workerPath: normalizeRelative(previewArtifact.workerPath),
    assetsPath: normalizeRelative(previewArtifact.assetsPath),
    filterVersion: productScopedPreviewFilterVersion,
    filterGeneratedAt: generatedAt,
    runtimeIntegrity: filterReport.runtimeIntegrity,
    unresolvedDependencyCount: filterReport.unresolvedDependencies.length,
    removedCount: filterReport.removedCount,
    remainingCount: filterReport.remainingCount,
    scopeMode: scopeAudit.scopeMode,
    containsForeignRoutes: scopeAudit.containsForeignRoutes,
    foreignRouteHits: scopeAudit.foreignRouteHits,
    foreignRouteCount: scopeAudit.foreignRouteCount,
    scopeAuditVersion: scopeAudit.scopeAuditVersion,
    scopeAuditGeneratedAt: scopeAudit.scopeAuditGeneratedAt,
    scopedReady: scopeAudit.scopedReady,
    runtimeAuditVersion: runtimeAudit.runtimeAuditVersion,
    runtimeAuditGeneratedAt: runtimeAudit.runtimeAuditGeneratedAt,
    runtimeRiskScore: runtimeAudit.runtimeRiskScore,
    scopedActivationReady: runtimeAudit.scopedActivationReady,
    suspiciousRoutes: runtimeAudit.suspiciousRoutes,
    crossProductLeaks: runtimeAudit.crossProductLeaks,
    unknownRoutes: runtimeAudit.unknownRoutes,
  };

  await fs.writeFile(path.join(previewRoot, "artifact-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(previewRoot, "scope-audit.json"), `${JSON.stringify(scopeAudit, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(previewRoot, "filter-report.json"), `${JSON.stringify(filterReport, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(previewRoot, "runtime-audit.json"), `${JSON.stringify(runtimeAudit, null, 2)}\n`, "utf8");
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
  const productScopedPreviewArtifact = (config.productScopedPreviews ?? []).find((artifact) => artifact.key === product.key);
  const standaloneWorkerAbsolute = standaloneArtifact?.workerPath
    ? path.resolve(repoRoot, standaloneArtifact.workerPath)
    : null;
  const standaloneAssetsAbsolute = standaloneArtifact?.assetsPath
    ? path.resolve(repoRoot, standaloneArtifact.assetsPath)
    : null;
  const productScopedPreviewWorkerAbsolute = productScopedPreviewArtifact?.workerPath
    ? path.resolve(repoRoot, productScopedPreviewArtifact.workerPath)
    : null;
  const productScopedPreviewAssetsAbsolute = productScopedPreviewArtifact?.assetsPath
    ? path.resolve(repoRoot, productScopedPreviewArtifact.assetsPath)
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

  const shouldGenerateProductScopedPreview =
    productScopedPreviewArtifact?.artifactMode === "product-scoped-preview" &&
    standaloneArtifact?.key === product.key &&
    (await fileExists(path.resolve(repoRoot, standaloneArtifact.workerPath))) &&
    (await fileExists(path.resolve(repoRoot, standaloneArtifact.assetsPath)));

  if (shouldGenerateProductScopedPreview) {
    await emitSocialflowProductScopedPreviewArtifact(standaloneArtifact, productScopedPreviewArtifact);
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
    productScopedPreviewArtifact: productScopedPreviewArtifact
      ? {
          artifactMode: productScopedPreviewArtifact.artifactMode,
          artifactState: productScopedPreviewArtifact.artifactState ?? null,
          derivedFrom: productScopedPreviewArtifact.derivedFrom ?? null,
          artifactName: productScopedPreviewArtifact.artifactName,
          workerPath: normalizeRelative(productScopedPreviewArtifact.workerPath),
          assetsPath: normalizeRelative(productScopedPreviewArtifact.assetsPath),
          exists: {
            worker: productScopedPreviewWorkerAbsolute ? await fileExists(productScopedPreviewWorkerAbsolute) : false,
            assets: productScopedPreviewAssetsAbsolute ? await fileExists(productScopedPreviewAssetsAbsolute) : false,
          },
          deployable: productScopedPreviewArtifact.deployable ?? false,
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
    productScopedPreviewArtifactName: productScopedPreviewArtifact?.artifactName ?? null,
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
    productScopedPreviews: config.productScopedPreviews ?? [],
    products: records.map((record) => ({
      artifactMode: record.artifactMode,
      artifactState: record.artifactState,
      productKey: record.productKey,
      workerName: record.workerName,
      wranglerConfigPath: record.wranglerConfigPath,
      currentArtifact: record.currentArtifact,
      plannedArtifact: record.plannedArtifact,
      standaloneArtifact: record.standaloneArtifact,
      productScopedPreviewArtifact: record.productScopedPreviewArtifact,
      splitReady: record.splitReady,
      splitActivated: record.splitActivated,
      dedicatedArtifactName: record.dedicatedArtifactName,
      preparedArtifactName: record.preparedArtifactName,
      standaloneArtifactName: record.standaloneArtifactName,
      productScopedPreviewArtifactName: record.productScopedPreviewArtifactName,
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
