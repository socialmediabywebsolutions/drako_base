import fs from "node:fs";
import path from "node:path";
import { CONTROL_PLANE_CONTRACT_NAMES } from "../../packages/shared-neutral/src/control-plane-contracts";

export type SeparationClass =
  | "DRAKO_BRAND"
  | "CONTROL_PLANE"
  | "SOCIALFLOW_PRODUCT"
  | "MENTORIA_PRODUCT"
  | "FACTORY"
  | "SHARED_CORE"
  | "LEGACY_COMPAT"
  | "UNKNOWN_REVIEW"
  | "BLOCKER";

export type RouteInventoryEntry = {
  kind: "api" | "ui";
  route: string;
  filePath: string;
  classification: SeparationClass;
  notes: string[];
};

export type BindingInfo = {
  d1: Array<{ binding: string; databaseName: string }>;
  kv: Array<{ binding: string; id: string }>;
  r2: Array<{ binding: string; bucketName: string }>;
  queues: Array<{ binding: string; queue: string }>;
  services: Array<{ binding: string; service: string }>;
};

export type RuntimeTopologyEntry = {
  runtimeKey: string;
  sourceConfigPath: string;
  classification: SeparationClass;
  workerName: string;
  isRootHybridRuntime: boolean;
  canonicalForProductProduction: boolean;
  domains: string[];
  envVarNames: string[];
  authDbBindings: string[];
  bindings: BindingInfo;
  notes: string[];
};

export type AppRuntimeEntry = {
  appKey: string;
  sourcePath: string;
  classification: SeparationClass;
};

export type WorkerInventoryEntry = {
  workerKey: string;
  sourcePath: string;
  classification: SeparationClass;
};

export type CrossImportSignal = {
  ruleId:
    | "factory-no-campamento-internals"
    | "campamento-no-product-internals"
    | "saas-no-campamento-internals"
    | "shared-neutral-no-runtime-imports"
    | "shared-neutral-contracts-no-business-logic";
  filePath: string;
  importPath?: string;
  detail: string;
  classification: "BLOCKER" | "UNKNOWN_REVIEW";
};

export type LegacyAliasSignal = {
  alias: "owner" | "campobase";
  sourcePath: string;
  routePath: string;
  canonicalTarget: string;
  status: "LEGACY_COMPAT_ACCEPTED" | "NEEDS_DEPRECATION" | "NEEDS_CUT" | "BLOCKER" | "UNKNOWN_REVIEW";
};

export type LegacyAliasSummary = {
  total: number;
  owner: number;
  campobase: number;
  needsDeprecation: number;
  blockers: number;
  entries: LegacyAliasSignal[];
};

export type CanonicalSurfaceSummary = {
  operator: number;
  campamentoBase: number;
};

export type PlaceholderSignal = {
  token: string;
  sourcePath: string;
  line: number;
  snippet: string;
};

export type SeparationAuditSnapshot = {
  generatedAt: string;
  contractsCatalog: readonly string[];
  routeSummary: {
    total: number;
    byKind: Record<"api" | "ui", number>;
    byClass: Record<SeparationClass, number>;
  };
  topologySummary: {
    runtimes: number;
    apps: number;
    workers: number;
    wranglerConfigs: number;
    dbBindings: number;
    authDbBindings: number;
    queueBindings: number;
    serviceBindings: number;
    domains: number;
    envVarNames: number;
  };
  legacyAliases: LegacyAliasSummary;
  canonicalSurfaces: CanonicalSurfaceSummary;
  placeholderSignals: PlaceholderSignal[];
  crossImportSignals: CrossImportSignal[];
  blockers: string[];
  unknownReview: string[];
  routeInventoryPath: string;
  runtimeTopologyPath: string;
};

export type SeparationAuditArtifacts = {
  routeInventory: {
    generatedAt: string;
    entries: RouteInventoryEntry[];
  };
  runtimeTopology: {
    generatedAt: string;
    wranglerConfigs: string[];
    apps: AppRuntimeEntry[];
    workers: WorkerInventoryEntry[];
    runtimes: RuntimeTopologyEntry[];
  };
  auditSnapshot: SeparationAuditSnapshot;
};

const CATEGORY_VALUES: SeparationClass[] = [
  "DRAKO_BRAND",
  "CONTROL_PLANE",
  "SOCIALFLOW_PRODUCT",
  "MENTORIA_PRODUCT",
  "FACTORY",
  "SHARED_CORE",
  "LEGACY_COMPAT",
  "UNKNOWN_REVIEW",
  "BLOCKER",
];

const DEFAULT_ROUTE_OUTPUT = "docs/config/control-plane-route-inventory.json";
const DEFAULT_TOPOLOGY_OUTPUT = "docs/config/runtime-topology-matrix.json";
const DEFAULT_AUDIT_OUTPUT = "docs/config/control-plane-separation-audit.json";

const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const WRANGLER_FILE_PATTERN = /^wrangler(?:\.[^/\\]+)?\.(?:toml|jsonc)$/;

const PLACEHOLDER_TOKENS = ["TODO", "FIXME", "PLACEHOLDER", "fallback", "demo", "mock"] as const;

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function listFilesRecursive(dir: string, out: string[], predicate: (fileName: string) => boolean): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFilesRecursive(fullPath, out, predicate);
      continue;
    }
    if (predicate(entry.name)) out.push(fullPath);
  }
}

function listCodeFiles(root: string): string[] {
  const out: string[] = [];
  listFilesRecursive(root, out, (fileName) => CODE_FILE_PATTERN.test(fileName) && !fileName.endsWith(".d.ts"));
  return out.sort();
}

function stripRouteGroups(segment: string): string | null {
  if (!segment) return null;
  if (segment.startsWith("(") && segment.endsWith(")")) return null;
  if (segment.startsWith("@")) return null;
  return segment;
}

function normalizeNextRouteSegments(relativePath: string): string[] {
  return toPosix(relativePath)
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map(stripRouteGroups)
    .filter((segment): segment is string => Boolean(segment));
}

function classifyFromPath(routeOrPath: string): SeparationClass {
  const value = routeOrPath.toLowerCase();

  if (value.includes("/factory") || value.includes("factory")) return "FACTORY";
  if (value.includes("/campobase") || value.includes("/owner")) return "LEGACY_COMPAT";
  if (value.includes("/socialflow") || value.includes("/socialflows") || value.includes("/api/social")) {
    return "SOCIALFLOW_PRODUCT";
  }
  if (value.includes("/mentoria") || value.includes("/mentorias")) return "MENTORIA_PRODUCT";
  if (value.includes("/campamento-base") || value.includes("/operator")) return "CONTROL_PLANE";
  if (value.includes("packages/shared") || value.includes("/shared/")) return "SHARED_CORE";
  if (value.startsWith("/api")) return "UNKNOWN_REVIEW";
  return "DRAKO_BRAND";
}

function routeFromApiFile(projectRoot: string, filePath: string): string {
  const rel = path.relative(path.resolve(projectRoot, "src/app/api"), filePath);
  const routeSegments = normalizeNextRouteSegments(rel.replace(/\/route\.[cm]?[jt]sx?$/, ""));
  return `/api/${routeSegments.join("/")}`.replace(/\/+/g, "/");
}

function routeFromUiPage(projectRoot: string, filePath: string): string {
  const rel = path.relative(path.resolve(projectRoot, "src/app"), filePath);
  const normalized = rel.replace(/\/page\.[cm]?[jt]sx?$/, "");
  const segments = normalizeNextRouteSegments(normalized);
  if (segments.length === 0) return "/";
  return `/${segments.join("/")}`.replace(/\/+/g, "/");
}

function extractImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^"'`]+?\s+from\s+)?["'`]([^"'`]+)["'`]/g,
    /\bexport\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["'`]([^"'`]+)["'`]/g,
    /\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) specifiers.add(match[1].trim());
    }
  }

  return Array.from(specifiers).sort();
}

function stripJsoncComments(source: string): string {
  return source.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*#.*$/gm, "");
}

function readKeyValue(block: string, key: string): string | null {
  const tomlMatch = block.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]+)"`, "m"));
  if (tomlMatch?.[1]) return tomlMatch[1];
  const jsoncMatch = block.match(new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, "m"));
  if (jsoncMatch?.[1]) return jsoncMatch[1];
  return null;
}

function collectTomlSectionBlocks(source: string, section: string): string[] {
  const pattern = new RegExp(`\\[\\[${section.replace(".", "\\.")}\\]\\]([\\s\\S]*?)(?=\\n\\[\\[|\\n\\[|$)`, "g");
  return Array.from(source.matchAll(pattern), (match) => match[1] ?? "");
}

function collectJsoncArrayObjects(source: string, key: string): Array<Record<string, unknown>> {
  try {
    const parsed = JSON.parse(stripJsoncComments(source)) as Record<string, unknown>;
    const values = parsed[key];
    if (!Array.isArray(values)) return [];
    return values.filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object");
  } catch {
    return [];
  }
}

function parseTomlVars(source: string): string[] {
  const varsBlock = source.match(/\[vars\]([\s\S]*?)(?=\n\[|$)/);
  if (!varsBlock?.[1]) return [];
  return Array.from(
    varsBlock[1].matchAll(/^\s*([A-Z0-9_]+)\s*=/gm),
    (match) => match[1],
  ).filter(Boolean);
}

function parseJsoncVars(source: string): string[] {
  try {
    const parsed = JSON.parse(stripJsoncComments(source)) as Record<string, unknown>;
    const vars = parsed.vars;
    if (!vars || typeof vars !== "object") return [];
    return Object.keys(vars as Record<string, unknown>).sort();
  } catch {
    return [];
  }
}

function collectWranglerConfigPaths(projectRoot: string): string[] {
  const out = new Set<string>();
  const rootWrangler = path.resolve(projectRoot, "wrangler.jsonc");
  if (fs.existsSync(rootWrangler)) out.add(rootWrangler);

  for (const scope of ["workers", "apps"]) {
    const absoluteScope = path.resolve(projectRoot, scope);
    if (!fs.existsSync(absoluteScope)) continue;
    const discovered: string[] = [];
    listFilesRecursive(absoluteScope, discovered, (fileName) => WRANGLER_FILE_PATTERN.test(fileName));
    for (const filePath of discovered) out.add(filePath);
  }

  return Array.from(out).sort();
}

function parseWranglerConfig(projectRoot: string, absolutePath: string): RuntimeTopologyEntry {
  const relativePath = toPosix(path.relative(projectRoot, absolutePath));
  const raw = fs.readFileSync(absolutePath, "utf8");
  const isJsonc = absolutePath.endsWith(".jsonc");
  const workerName = readKeyValue(raw, "name") ?? path.basename(path.dirname(absolutePath));
  const classification = classifyFromPath(relativePath);

  const d1 = isJsonc
    ? collectJsoncArrayObjects(raw, "d1_databases")
      .map((item) => ({
        binding: typeof item.binding === "string" ? item.binding : "",
        databaseName: typeof item.database_name === "string" ? item.database_name : "",
      }))
      .filter((item) => item.binding && item.databaseName)
    : collectTomlSectionBlocks(raw, "d1_databases")
      .map((block) => ({
        binding: readKeyValue(block, "binding") ?? "",
        databaseName: readKeyValue(block, "database_name") ?? "",
      }))
      .filter((item) => item.binding && item.databaseName);

  const kv = isJsonc
    ? collectJsoncArrayObjects(raw, "kv_namespaces")
      .map((item) => ({
        binding: typeof item.binding === "string" ? item.binding : "",
        id: typeof item.id === "string" ? item.id : "",
      }))
      .filter((item) => item.binding && item.id)
    : collectTomlSectionBlocks(raw, "kv_namespaces")
      .map((block) => ({
        binding: readKeyValue(block, "binding") ?? "",
        id: readKeyValue(block, "id") ?? "",
      }))
      .filter((item) => item.binding && item.id);

  const r2 = isJsonc
    ? collectJsoncArrayObjects(raw, "r2_buckets")
      .map((item) => ({
        binding: typeof item.binding === "string" ? item.binding : "",
        bucketName: typeof item.bucket_name === "string" ? item.bucket_name : "",
      }))
      .filter((item) => item.binding && item.bucketName)
    : collectTomlSectionBlocks(raw, "r2_buckets")
      .map((block) => ({
        binding: readKeyValue(block, "binding") ?? "",
        bucketName: readKeyValue(block, "bucket_name") ?? "",
      }))
      .filter((item) => item.binding && item.bucketName);

  const queues = isJsonc
    ? collectJsoncArrayObjects(raw, "queues")
      .map((item) => ({
        binding: typeof item.binding === "string" ? item.binding : "",
        queue: typeof item.queue === "string" ? item.queue : "",
      }))
      .filter((item) => item.binding && item.queue)
    : collectTomlSectionBlocks(raw, "queues.producers")
      .map((block) => ({
        binding: readKeyValue(block, "binding") ?? "",
        queue: readKeyValue(block, "queue") ?? "",
      }))
      .filter((item) => item.binding && item.queue);

  const services = isJsonc
    ? collectJsoncArrayObjects(raw, "services")
      .map((item) => ({
        binding: typeof item.binding === "string" ? item.binding : "",
        service: typeof item.service === "string" ? item.service : "",
      }))
      .filter((item) => item.binding && item.service)
    : collectTomlSectionBlocks(raw, "services")
      .map((block) => ({
        binding: readKeyValue(block, "binding") ?? "",
        service: readKeyValue(block, "service") ?? "",
      }))
      .filter((item) => item.binding && item.service);

  const domains = Array.from(raw.matchAll(/^\s*pattern\s*=\s*"([^"]+)"/gm), (match) => match[1]).filter(Boolean);
  const envVarNames = isJsonc ? parseJsoncVars(raw) : parseTomlVars(raw);
  const authDbBindings = d1
    .map((binding) => binding.binding)
    .filter((binding) => binding.toUpperCase().includes("AUTH"))
    .sort();

  const isRootHybridRuntime = relativePath === "wrangler.jsonc";
  const canonicalForProductProduction = (
    relativePath === "workers/socialflows/wrangler.workers.toml"
    || relativePath === "workers/mentorias/wrangler.workers.toml"
  );

  const notes: string[] = [];
  if (isRootHybridRuntime) notes.push("root-runtime-hybrid-shell");
  if (d1.some((item) => item.binding === "DRACO_DB") && d1.some((item) => item.binding === "MENTORIA_DB")) {
    notes.push("mixed-root-product-d1-bindings");
  }
  if (queues.some((item) => item.queue.startsWith("drako-")) && relativePath.includes("workers/mentorias")) {
    notes.push("mentoria-still-using-drako-queues");
  }

  return {
    runtimeKey: workerName || path.basename(path.dirname(absolutePath)),
    sourceConfigPath: relativePath,
    classification,
    workerName,
    isRootHybridRuntime,
    canonicalForProductProduction,
    domains: domains.sort(),
    envVarNames,
    authDbBindings,
    bindings: { d1, kv, r2, queues, services },
    notes,
  };
}

function classifyAppOrWorkerName(name: string, kind: "apps" | "workers"): SeparationClass {
  const value = name.toLowerCase();
  if (value.includes("socialflow") || value.includes("socialflows")) return "SOCIALFLOW_PRODUCT";
  if (value.includes("mentoria") || value.includes("mentorias")) return "MENTORIA_PRODUCT";
  if (value.includes("factory")) return "FACTORY";
  if (value.includes("campamento") || value.includes("operator")) return "CONTROL_PLANE";
  if (value.includes("campobase") || value.includes("owner")) return "LEGACY_COMPAT";
  if (kind === "apps" && value.includes("drako")) return "DRAKO_BRAND";
  return "UNKNOWN_REVIEW";
}

function collectApps(projectRoot: string): AppRuntimeEntry[] {
  const appsRoot = path.resolve(projectRoot, "apps");
  if (!fs.existsSync(appsRoot)) return [];

  return fs.readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      appKey: entry.name,
      sourcePath: toPosix(path.join("apps", entry.name)),
      classification: classifyAppOrWorkerName(entry.name, "apps"),
    }))
    .sort((left, right) => left.appKey.localeCompare(right.appKey));
}

function collectWorkers(projectRoot: string): WorkerInventoryEntry[] {
  const workersRoot = path.resolve(projectRoot, "workers");
  if (!fs.existsSync(workersRoot)) return [];

  return fs.readdirSync(workersRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      workerKey: entry.name,
      sourcePath: toPosix(path.join("workers", entry.name)),
      classification: classifyAppOrWorkerName(entry.name, "workers"),
    }))
    .sort((left, right) => left.workerKey.localeCompare(right.workerKey));
}

function collectCrossImportSignals(projectRoot: string): CrossImportSignal[] {
  const signals: CrossImportSignal[] = [];

  const evaluateImports = (
    sourceDirs: string[],
    push: (filePath: string, importPath: string) => void,
  ) => {
    for (const sourceDir of sourceDirs) {
      const absoluteDir = path.resolve(projectRoot, sourceDir);
      for (const filePath of listCodeFiles(absoluteDir)) {
        const source = fs.readFileSync(filePath, "utf8");
        const imports = extractImportSpecifiers(source);
        for (const importPath of imports) {
          push(filePath, importPath);
        }
      }
    }
  };

  evaluateImports(["src/app/api/factory", "src/lib/factory"], (filePath, importPath) => {
    if (!importPath.startsWith("@/lib/campamento-base/") && !importPath.startsWith("@/lib/campobase/")) return;
    signals.push({
      ruleId: "factory-no-campamento-internals",
      filePath: toPosix(path.relative(projectRoot, filePath)),
      importPath,
      detail: "Factory imports Campamento Base internals.",
      classification: "BLOCKER",
    });
  });

  evaluateImports(["src/lib/campobase", "src/lib/campamento-base", "src/app/api/operator"], (filePath, importPath) => {
    const socialflowInternal = importPath.startsWith("@/lib/socialflow/") && !importPath.startsWith("@/lib/socialflow/contracts/");
    const mentoriaInternal = importPath.startsWith("@/lib/mentoria/") && !importPath.startsWith("@/lib/mentoria/contracts/");
    if (!socialflowInternal && !mentoriaInternal) return;
    signals.push({
      ruleId: "campamento-no-product-internals",
      filePath: toPosix(path.relative(projectRoot, filePath)),
      importPath,
      detail: "Control plane imports product internals outside contracts.",
      classification: "BLOCKER",
    });
  });

  evaluateImports(
    ["src/lib/socialflow", "src/app/api/socialflow", "src/lib/mentoria", "src/app/api/mentoria"],
    (filePath, importPath) => {
      if (
        !importPath.startsWith("@/lib/campamento-base/")
        && !importPath.startsWith("@/lib/campobase/")
        && !importPath.startsWith("@/lib/operator/")
        && !importPath.startsWith("@/lib/owner/")
      ) {
        return;
      }
      signals.push({
        ruleId: "saas-no-campamento-internals",
        filePath: toPosix(path.relative(projectRoot, filePath)),
        importPath,
        detail: "SaaS imports control-plane internals.",
        classification: "BLOCKER",
      });
    },
  );

  evaluateImports(["packages/shared-neutral"], (filePath, importPath) => {
    if (
      !importPath.startsWith("@/lib/socialflow/")
      && !importPath.startsWith("@/lib/mentoria/")
      && !importPath.startsWith("@/lib/campamento-base/")
      && !importPath.startsWith("@/lib/campobase/")
      && !importPath.startsWith("@/app/")
    ) {
      return;
    }
    signals.push({
      ruleId: "shared-neutral-no-runtime-imports",
      filePath: toPosix(path.relative(projectRoot, filePath)),
      importPath,
      detail: "Shared-neutral imports runtime internals.",
      classification: "BLOCKER",
    });
  });

  const contractsFile = path.resolve(projectRoot, "packages/shared-neutral/src/control-plane-contracts.ts");
  if (fs.existsSync(contractsFile)) {
    const source = fs.readFileSync(contractsFile, "utf8");
    const forbiddenTokens = ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "FROM "];
    for (const token of forbiddenTokens) {
      if (!source.includes(token)) continue;
      signals.push({
        ruleId: "shared-neutral-contracts-no-business-logic",
        filePath: toPosix(path.relative(projectRoot, contractsFile)),
        detail: `Neutral contracts include business token: ${token.trim()}`,
        classification: "BLOCKER",
      });
    }
  }

  return signals.sort((left, right) =>
    `${left.ruleId}|${left.filePath}|${left.importPath ?? ""}`.localeCompare(`${right.ruleId}|${right.filePath}|${right.importPath ?? ""}`),
  );
}

function modulePathToApiRoute(modulePath: string): string {
  if (!modulePath.startsWith("@/app/api/")) return modulePath;
  const normalized = modulePath.replace(/^@\/app\/api\//, "");
  return `/${normalized.replace(/\/route$/, "")}`.replace(/^\/+/, "/api/");
}

function collectLegacyAliases(projectRoot: string, routeInventory: RouteInventoryEntry[]): LegacyAliasSummary {
  const entries: LegacyAliasSignal[] = [];
  const apiRoutes = routeInventory.filter((route) => route.kind === "api");
  const ownerRoutePattern = /^\/api\/owner(?:\/|$)/;
  const campobaseRoutePattern = /^\/api\/campobase(?:\/|$)/;

  for (const route of apiRoutes) {
    const routePath = route.route.toLowerCase();
    if (!ownerRoutePattern.test(routePath) && !campobaseRoutePattern.test(routePath)) continue;

    const isOwner = ownerRoutePattern.test(routePath);
    const alias: LegacyAliasSignal["alias"] = isOwner ? "owner" : "campobase";
    const absolutePath = path.resolve(projectRoot, route.filePath);
    const source = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
    const match = source.match(/export\s+\{[^}]+\}\s+from\s+["'`]([^"'`]+)["'`]/);
    const canonicalTarget = match?.[1] ? modulePathToApiRoute(match[1]) : "UNKNOWN";

    entries.push({
      alias,
      sourcePath: route.filePath,
      routePath: route.route,
      canonicalTarget,
      status: isOwner ? "NEEDS_DEPRECATION" : "LEGACY_COMPAT_ACCEPTED",
    });
  }

  const sortedEntries = entries.sort((left, right) =>
    `${left.alias}:${left.routePath}:${left.sourcePath}`.localeCompare(
      `${right.alias}:${right.routePath}:${right.sourcePath}`,
    ),
  );

  const owner = sortedEntries.filter((entry) => entry.alias === "owner").length;
  const campobase = sortedEntries.filter((entry) => entry.alias === "campobase").length;
  const needsDeprecation = sortedEntries.filter((entry) => entry.status === "NEEDS_DEPRECATION").length;
  const blockers = sortedEntries.filter((entry) => entry.status === "BLOCKER").length;

  return {
    total: sortedEntries.length,
    owner,
    campobase,
    needsDeprecation,
    blockers,
    entries: sortedEntries,
  };
}

function collectCanonicalSurfaces(routeInventory: RouteInventoryEntry[]): CanonicalSurfaceSummary {
  const operator = routeInventory.filter(
    (route) => route.kind === "api" && route.route.toLowerCase().startsWith("/api/operator"),
  ).length;
  const campamentoBase = routeInventory.filter(
    (route) => route.kind === "api" && route.route.toLowerCase().startsWith("/api/campamento-base"),
  ).length;

  return { operator, campamentoBase };
}

function collectPlaceholderSignals(projectRoot: string): PlaceholderSignal[] {
  const sources = ["src/app/api", "src/lib", "scripts"];
  const signals: PlaceholderSignal[] = [];

  for (const sourceRoot of sources) {
    const absoluteRoot = path.resolve(projectRoot, sourceRoot);
    for (const filePath of listCodeFiles(absoluteRoot)) {
      const source = fs.readFileSync(filePath, "utf8");
      const lines = source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index] ?? "";
        for (const token of PLACEHOLDER_TOKENS) {
          const pattern = new RegExp(`\\b${token}\\b`, "i");
          if (!pattern.test(line)) continue;
          signals.push({
            token,
            sourcePath: toPosix(path.relative(projectRoot, filePath)),
            line: index + 1,
            snippet: line.trim().slice(0, 160),
          });
          break;
        }
      }
    }
  }

  return signals
    .sort((left, right) => `${left.sourcePath}:${left.line}`.localeCompare(`${right.sourcePath}:${right.line}`))
    .slice(0, 400);
}

export function collectApiRouteInventory(projectRoot = process.cwd()): RouteInventoryEntry[] {
  const apiRoot = path.resolve(projectRoot, "src/app/api");
  const files: string[] = [];
  listFilesRecursive(apiRoot, files, (fileName) => /^route\.[cm]?[jt]sx?$/.test(fileName));

  return files
    .map((filePath) => {
      const route = routeFromApiFile(projectRoot, filePath);
      const classification = classifyFromPath(route);
      const notes: string[] = [];
      if (classification === "LEGACY_COMPAT") notes.push("legacy-alias-surface");
      if (classification === "UNKNOWN_REVIEW") notes.push("manual-classification-required");
      return {
        kind: "api" as const,
        route,
        filePath: toPosix(path.relative(projectRoot, filePath)),
        classification,
        notes,
      };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

export function collectUiRouteInventory(projectRoot = process.cwd()): RouteInventoryEntry[] {
  const appRoot = path.resolve(projectRoot, "src/app");
  const files: string[] = [];
  listFilesRecursive(appRoot, files, (fileName) => /^page\.[cm]?[jt]sx?$/.test(fileName));

  return files
    .map((filePath) => {
      const route = routeFromUiPage(projectRoot, filePath);
      const classification = classifyFromPath(route);
      const notes: string[] = [];
      if (classification === "LEGACY_COMPAT") notes.push("legacy-alias-surface");
      if (classification === "UNKNOWN_REVIEW") notes.push("manual-classification-required");
      return {
        kind: "ui" as const,
        route,
        filePath: toPosix(path.relative(projectRoot, filePath)),
        classification,
        notes,
      };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

export function collectRouteInventory(projectRoot = process.cwd()): RouteInventoryEntry[] {
  return [...collectApiRouteInventory(projectRoot), ...collectUiRouteInventory(projectRoot)]
    .sort((left, right) => `${left.kind}:${left.route}`.localeCompare(`${right.kind}:${right.route}`));
}

export function collectRuntimeTopology(projectRoot = process.cwd()): {
  wranglerConfigs: string[];
  apps: AppRuntimeEntry[];
  workers: WorkerInventoryEntry[];
  runtimes: RuntimeTopologyEntry[];
} {
  const wranglerConfigs = collectWranglerConfigPaths(projectRoot).map((absolutePath) => toPosix(path.relative(projectRoot, absolutePath)));
  const runtimes = collectWranglerConfigPaths(projectRoot)
    .map((absolutePath) => parseWranglerConfig(projectRoot, absolutePath))
    .sort((left, right) => left.sourceConfigPath.localeCompare(right.sourceConfigPath));

  return {
    wranglerConfigs,
    apps: collectApps(projectRoot),
    workers: collectWorkers(projectRoot),
    runtimes,
  };
}

function countByClass(entries: RouteInventoryEntry[]): Record<SeparationClass, number> {
  const record = Object.fromEntries(CATEGORY_VALUES.map((value) => [value, 0])) as Record<SeparationClass, number>;
  for (const entry of entries) {
    record[entry.classification] += 1;
  }
  return record;
}

export function collectSeparationAuditSnapshot(projectRoot = process.cwd()): SeparationAuditSnapshot {
  const routes = collectRouteInventory(projectRoot);
  const topology = collectRuntimeTopology(projectRoot);
  const legacyAliases = collectLegacyAliases(projectRoot, routes);
  const canonicalSurfaces = collectCanonicalSurfaces(routes);
  const placeholderSignals = collectPlaceholderSignals(projectRoot);
  const crossImportSignals = collectCrossImportSignals(projectRoot);

  const blockers = crossImportSignals
    .filter((signal) => signal.classification === "BLOCKER")
    .map((signal) => `${signal.ruleId}: ${signal.filePath}${signal.importPath ? ` -> ${signal.importPath}` : ""}`);

  const unknownReview = routes
    .filter((entry) => entry.classification === "UNKNOWN_REVIEW")
    .map((entry) => `${entry.kind}:${entry.route}`);

  const dbBindings = topology.runtimes.flatMap((runtime) => runtime.bindings.d1);
  const queueBindings = topology.runtimes.flatMap((runtime) => runtime.bindings.queues);
  const serviceBindings = topology.runtimes.flatMap((runtime) => runtime.bindings.services);
  const authDbBindings = topology.runtimes.flatMap((runtime) => runtime.authDbBindings);
  const domains = topology.runtimes.flatMap((runtime) => runtime.domains);
  const envVarNames = topology.runtimes.flatMap((runtime) => runtime.envVarNames);

  return {
    generatedAt: new Date().toISOString(),
    contractsCatalog: CONTROL_PLANE_CONTRACT_NAMES,
    routeSummary: {
      total: routes.length,
      byKind: {
        api: routes.filter((entry) => entry.kind === "api").length,
        ui: routes.filter((entry) => entry.kind === "ui").length,
      },
      byClass: countByClass(routes),
    },
    topologySummary: {
      runtimes: topology.runtimes.length,
      apps: topology.apps.length,
      workers: topology.workers.length,
      wranglerConfigs: topology.wranglerConfigs.length,
      dbBindings: dbBindings.length,
      authDbBindings: authDbBindings.length,
      queueBindings: queueBindings.length,
      serviceBindings: serviceBindings.length,
      domains: domains.length,
      envVarNames: envVarNames.length,
    },
    legacyAliases,
    canonicalSurfaces,
    placeholderSignals,
    crossImportSignals,
    blockers,
    unknownReview,
    routeInventoryPath: DEFAULT_ROUTE_OUTPUT,
    runtimeTopologyPath: DEFAULT_TOPOLOGY_OUTPUT,
  };
}

export function buildSeparationAuditArtifacts(projectRoot = process.cwd()): SeparationAuditArtifacts {
  const routeInventory = {
    generatedAt: new Date().toISOString(),
    entries: collectRouteInventory(projectRoot),
  };

  const runtimeTopology = {
    generatedAt: new Date().toISOString(),
    ...collectRuntimeTopology(projectRoot),
  };

  const auditSnapshot = collectSeparationAuditSnapshot(projectRoot);
  return { routeInventory, runtimeTopology, auditSnapshot };
}

export function writeSeparationAuditArtifacts(projectRoot = process.cwd()): SeparationAuditArtifacts {
  const artifacts = buildSeparationAuditArtifacts(projectRoot);

  const routeOutput = path.resolve(projectRoot, DEFAULT_ROUTE_OUTPUT);
  const topologyOutput = path.resolve(projectRoot, DEFAULT_TOPOLOGY_OUTPUT);
  const auditOutput = path.resolve(projectRoot, DEFAULT_AUDIT_OUTPUT);

  ensureParentDir(routeOutput);
  ensureParentDir(topologyOutput);
  ensureParentDir(auditOutput);

  fs.writeFileSync(routeOutput, `${JSON.stringify(artifacts.routeInventory, null, 2)}\n`, "utf8");
  fs.writeFileSync(topologyOutput, `${JSON.stringify(artifacts.runtimeTopology, null, 2)}\n`, "utf8");
  fs.writeFileSync(auditOutput, `${JSON.stringify(artifacts.auditSnapshot, null, 2)}\n`, "utf8");

  return artifacts;
}

export function renderAuditMarkdown(artifacts: SeparationAuditArtifacts): string {
  const { auditSnapshot, routeInventory, runtimeTopology } = artifacts;

  const lines: string[] = [];
  lines.push("# Control Plane Separation Audit");
  lines.push("");
  lines.push(`Generated at: ${auditSnapshot.generatedAt}`);
  lines.push("");
  lines.push("## Route Summary");
  lines.push("");
  lines.push(`- Total routes: ${auditSnapshot.routeSummary.total}`);
  lines.push(`- API routes: ${auditSnapshot.routeSummary.byKind.api}`);
  lines.push(`- UI routes: ${auditSnapshot.routeSummary.byKind.ui}`);
  for (const category of CATEGORY_VALUES) {
    lines.push(`- ${category}: ${auditSnapshot.routeSummary.byClass[category]}`);
  }
  lines.push("");
  lines.push("## Topology Summary");
  lines.push("");
  lines.push(`- Runtimes: ${auditSnapshot.topologySummary.runtimes}`);
  lines.push(`- Apps: ${auditSnapshot.topologySummary.apps}`);
  lines.push(`- Workers: ${auditSnapshot.topologySummary.workers}`);
  lines.push(`- Wrangler configs: ${auditSnapshot.topologySummary.wranglerConfigs}`);
  lines.push(`- D1 bindings: ${auditSnapshot.topologySummary.dbBindings}`);
  lines.push(`- Auth DB bindings: ${auditSnapshot.topologySummary.authDbBindings}`);
  lines.push(`- Queue bindings: ${auditSnapshot.topologySummary.queueBindings}`);
  lines.push(`- Service bindings: ${auditSnapshot.topologySummary.serviceBindings}`);
  lines.push(`- Domains: ${auditSnapshot.topologySummary.domains}`);
  lines.push(`- Env var names: ${auditSnapshot.topologySummary.envVarNames}`);
  lines.push("");
  lines.push("## Risk Signals");
  lines.push("");
  lines.push(`- Legacy aliases (total): ${auditSnapshot.legacyAliases.total}`);
  lines.push(`- Legacy aliases (owner): ${auditSnapshot.legacyAliases.owner}`);
  lines.push(`- Legacy aliases (campobase): ${auditSnapshot.legacyAliases.campobase}`);
  lines.push(`- Legacy aliases (needs deprecation): ${auditSnapshot.legacyAliases.needsDeprecation}`);
  lines.push(`- Legacy aliases (blockers): ${auditSnapshot.legacyAliases.blockers}`);
  lines.push(`- Placeholder/demo/mock/TODO signals: ${auditSnapshot.placeholderSignals.length}`);
  lines.push(`- Cross import signals: ${auditSnapshot.crossImportSignals.length}`);
  lines.push(`- Blockers: ${auditSnapshot.blockers.length}`);
  lines.push(`- Unknown review: ${auditSnapshot.unknownReview.length}`);
  lines.push("");
  lines.push("## Canonical Surfaces");
  lines.push("");
  lines.push(`- /api/operator routes: ${auditSnapshot.canonicalSurfaces.operator}`);
  lines.push(`- /api/campamento-base routes: ${auditSnapshot.canonicalSurfaces.campamentoBase}`);
  lines.push("");
  lines.push("## Snapshot Paths");
  lines.push("");
  lines.push(`- Route inventory: ${auditSnapshot.routeInventoryPath}`);
  lines.push(`- Runtime topology: ${auditSnapshot.runtimeTopologyPath}`);
  lines.push(`- Audit snapshot: ${DEFAULT_AUDIT_OUTPUT}`);
  lines.push("");
  lines.push("## Sample Routes");
  lines.push("");
  for (const row of routeInventory.entries.slice(0, 10)) {
    lines.push(`- [${row.kind}] ${row.route} -> ${row.classification}`);
  }
  lines.push("");
  lines.push("## Sample Runtimes");
  lines.push("");
  for (const row of runtimeTopology.runtimes.slice(0, 10)) {
    lines.push(`- ${row.sourceConfigPath} -> ${row.classification} (${row.workerName})`);
  }

  return `${lines.join("\n")}\n`;
}
