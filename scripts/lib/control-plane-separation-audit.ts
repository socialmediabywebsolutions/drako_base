import fs from "node:fs";
import path from "node:path";
import { CONTROL_PLANE_CONTRACT_NAMES } from "../../packages/shared-neutral/src/control-plane-contracts";

export type SeparationDomain = "product" | "control-plane" | "factory" | "legacy";
export type SurfaceOwner =
  | "socialflow"
  | "mentoria"
  | "campamento-base"
  | "factory"
  | "drako-root"
  | "shared";

export type ApiSurfaceInventoryRow = {
  route: string;
  filePath: string;
  namespace: string;
  domain: SeparationDomain;
  owner: SurfaceOwner;
  maturity: "canonical" | "compat" | "legacy";
  notes: string[];
};

export type RuntimeTopologyRow = {
  runtimeKey: string;
  runtimeRole: "hybrid-root" | "product-runtime" | "product-canary" | "shared-service";
  workerName: string;
  sourceConfigPath: string;
  canonicalForProductProduction: boolean;
  domains: string[];
  bindings: {
    d1: Array<{ binding: string; databaseName: string }>;
    kv: Array<{ binding: string; id: string }>;
    r2: Array<{ binding: string; bucketName: string }>;
    queues: Array<{ binding: string; queue: string }>;
    services: Array<{ binding: string; service: string }>;
  };
  warnings: string[];
};

export type BlockedSignal = {
  sourcePath: string;
  token: string;
  classification: "legacy-block" | "compat-bridge" | "placeholder";
};

export type SeparationAuditSnapshot = {
  generatedAt: string;
  contractsCatalog: readonly string[];
  routeSummary: {
    total: number;
    byDomain: Record<SeparationDomain, number>;
  };
  blockedSignals: BlockedSignal[];
};

const API_ROOT = path.resolve(process.cwd(), "src/app/api");
const DEFAULT_ROUTE_OUTPUT = path.resolve(process.cwd(), "docs/config/control-plane-route-inventory.json");
const DEFAULT_RUNTIME_OUTPUT = path.resolve(process.cwd(), "docs/config/runtime-topology-matrix.json");
const DEFAULT_AUDIT_OUTPUT = path.resolve(process.cwd(), "docs/config/control-plane-separation-audit.json");

const RUNTIME_SOURCES: Array<{
  runtimeKey: string;
  runtimeRole: RuntimeTopologyRow["runtimeRole"];
  sourceConfigPath: string;
  canonicalForProductProduction: boolean;
}> = [
  {
    runtimeKey: "drako-root-open-next",
    runtimeRole: "hybrid-root",
    sourceConfigPath: "wrangler.jsonc",
    canonicalForProductProduction: false,
  },
  {
    runtimeKey: "drakos-prod",
    runtimeRole: "product-runtime",
    sourceConfigPath: "workers/drakos/wrangler.workers.toml",
    canonicalForProductProduction: false,
  },
  {
    runtimeKey: "bases-prod",
    runtimeRole: "product-runtime",
    sourceConfigPath: "workers/bases/wrangler.workers.toml",
    canonicalForProductProduction: false,
  },
  {
    runtimeKey: "mentorias-prod",
    runtimeRole: "product-runtime",
    sourceConfigPath: "workers/mentorias/wrangler.workers.toml",
    canonicalForProductProduction: true,
  },
  {
    runtimeKey: "socialflows-prod",
    runtimeRole: "product-runtime",
    sourceConfigPath: "workers/socialflows/wrangler.workers.toml",
    canonicalForProductProduction: true,
  },
  {
    runtimeKey: "socialflow-runtime-app-canary",
    runtimeRole: "product-canary",
    sourceConfigPath: "apps/socialflow-runtime/wrangler.toml",
    canonicalForProductProduction: false,
  },
  {
    runtimeKey: "socialflow-runtime-canary-wrapper",
    runtimeRole: "product-canary",
    sourceConfigPath: "workers/socialflows-runtime-canary/wrangler.workers.toml",
    canonicalForProductProduction: false,
  },
  {
    runtimeKey: "drako-scheduler",
    runtimeRole: "shared-service",
    sourceConfigPath: "workers/drako-scheduler/wrangler.workers.toml",
    canonicalForProductProduction: false,
  },
  {
    runtimeKey: "whatsapp-channel",
    runtimeRole: "shared-service",
    sourceConfigPath: "workers/whatsapp-channel/wrangler.workers.toml",
    canonicalForProductProduction: false,
  },
];

const BLOCKED_SIGNAL_SOURCES = [
  "package.json",
  "src/app/api/factory/provisioning/_blocked.ts",
  "src/workers/saas-factory-consumer.ts",
  "scripts/plan-socialflow-production-execution.ts",
];

const BLOCKED_SIGNAL_PATTERNS: Array<{
  token: string;
  classification: BlockedSignal["classification"];
}> = [
  { token: "ARCHIVED_WORKER_BLOCKED", classification: "legacy-block" },
  { token: "CANONICAL_DEPLOY_ONLY", classification: "legacy-block" },
  { token: "FACTORY_PROVISIONING_ROUTE_BLOCKED", classification: "legacy-block" },
  { token: "LEGACY_SAAS_FACTORY_QUEUE_BLOCKED", classification: "legacy-block" },
  { token: "PLACEHOLDER_ONLY", classification: "placeholder" },
  { token: "redirect(\"/operator/", classification: "compat-bridge" },
];

function toPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

function walk(dir: string, out: string[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (entry.name === "route.ts") {
      out.push(fullPath);
    }
  }
}

function routeFromApiFile(filePath: string): string {
  const rel = toPosix(path.relative(API_ROOT, filePath));
  const withoutSuffix = rel.replace(/\/route\.ts$/, "");
  return `/api/${withoutSuffix}`.replace(/\/+/g, "/");
}

function classifyApiSurface(route: string): Omit<ApiSurfaceInventoryRow, "route" | "filePath"> {
  const segments = route.replace(/^\/api\//, "").split("/").filter(Boolean);
  const namespace = segments[0] ?? "root";
  const notes: string[] = [];

  if (namespace === "socialflow" || namespace === "social") {
    return { namespace, domain: "product", owner: "socialflow", maturity: "canonical", notes };
  }
  if (namespace === "mentoria" || namespace === "mentorias") {
    return { namespace, domain: "product", owner: "mentoria", maturity: "canonical", notes };
  }
  if (namespace === "factory") {
    return { namespace, domain: "factory", owner: "factory", maturity: "canonical", notes };
  }
  if (namespace === "operator" || namespace === "campamento-base") {
    return { namespace, domain: "control-plane", owner: "campamento-base", maturity: "canonical", notes };
  }
  if (namespace === "campobase" || namespace === "owner") {
    notes.push("compat-surface");
    return { namespace, domain: "legacy", owner: "campamento-base", maturity: "compat", notes };
  }

  notes.push("root-hybrid-surface");
  return { namespace, domain: "legacy", owner: "drako-root", maturity: "legacy", notes };
}

export function collectApiSurfaceInventory(projectRoot = process.cwd()): ApiSurfaceInventoryRow[] {
  const apiRoot = path.resolve(projectRoot, "src/app/api");
  const files: string[] = [];
  walk(apiRoot, files);

  return files
    .map((filePath) => {
      const route = routeFromApiFile(filePath);
      const classification = classifyApiSurface(route);
      return {
        route,
        filePath: toPosix(path.relative(projectRoot, filePath)),
        ...classification,
      };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

function extractAllMatches(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern), (match) => match[1]).filter(Boolean);
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

function stripJsoncComments(source: string): string {
  return source
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/^\s*#.*$/gm, "");
}

function collectJsoncArrayObjects(source: string, key: string): Array<Record<string, unknown>> {
  const sanitized = stripJsoncComments(source);
  try {
    const parsed = JSON.parse(sanitized) as Record<string, unknown>;
    const values = parsed[key];
    return Array.isArray(values) ? values.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function parseRuntimeTopologyRow(projectRoot: string, source: (typeof RUNTIME_SOURCES)[number]): RuntimeTopologyRow {
  const absolutePath = path.resolve(projectRoot, source.sourceConfigPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const workerName = readKeyValue(raw, "name") ?? source.runtimeKey;
  const domains = extractAllMatches(raw, /^\s*pattern\s*=\s*"([^"]+)"/gm).sort();
  const isJsonc = source.sourceConfigPath.endsWith(".jsonc");
  const d1Bindings = isJsonc
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
  const kvBindings = isJsonc
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
  const r2Bindings = isJsonc
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
  const queueBindings = isJsonc
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
  const serviceBindings = isJsonc
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

  const warnings: string[] = [];
  if (source.runtimeRole === "hybrid-root") {
    warnings.push("root-runtime-remains-hybrid-and-non-canonical-for-product-production");
  }
  if (d1Bindings.some((item) => item.binding === "DRACO_DB") && d1Bindings.some((item) => item.binding === "MENTORIA_DB")) {
    warnings.push("shared-root-runtime-mixes-drako-and-product-d1-bindings");
  }
  if (source.runtimeKey === "socialflows-prod" && d1Bindings.some((item) => item.binding === "SAASES_DB")) {
    warnings.push("socialflow-prod-still-exposes-saases-registry-binding");
  }
  if (
    source.runtimeKey === "mentorias-prod"
    && (queueBindings.some((item) => item.queue.startsWith("drako-")) || serviceBindings.some((item) => item.service.startsWith("drako-")))
  ) {
    warnings.push("mentoria-prod-still-depends-on-drako-shared-queues-or-services");
  }
  if (
    source.runtimeKey === "socialflow-runtime-app-canary"
    && d1Bindings.some((item) => item.binding === "DRACO_DB")
  ) {
    warnings.push("socialflow-canary-runtime-still-reads-drako-db");
  }

  return {
    runtimeKey: source.runtimeKey,
    runtimeRole: source.runtimeRole,
    workerName,
    sourceConfigPath: source.sourceConfigPath,
    canonicalForProductProduction: source.canonicalForProductProduction,
    domains,
    bindings: {
      d1: d1Bindings,
      kv: kvBindings,
      r2: r2Bindings,
      queues: queueBindings,
      services: serviceBindings,
    },
    warnings,
  };
}

export function collectRuntimeTopologyMatrix(projectRoot = process.cwd()): RuntimeTopologyRow[] {
  return RUNTIME_SOURCES
    .map((source) => parseRuntimeTopologyRow(projectRoot, source))
    .sort((left, right) => left.runtimeKey.localeCompare(right.runtimeKey));
}

export function collectBlockedSignals(projectRoot = process.cwd()): BlockedSignal[] {
  const signals: BlockedSignal[] = [];

  for (const relativePath of BLOCKED_SIGNAL_SOURCES) {
    const absolutePath = path.resolve(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const raw = fs.readFileSync(absolutePath, "utf8");

    for (const pattern of BLOCKED_SIGNAL_PATTERNS) {
      if (!raw.includes(pattern.token)) continue;
      signals.push({
        sourcePath: toPosix(relativePath),
        token: pattern.token,
        classification: pattern.classification,
      });
    }
  }

  return signals.sort((left, right) => `${left.sourcePath}:${left.token}`.localeCompare(`${right.sourcePath}:${right.token}`));
}

export function collectSeparationAuditSnapshot(projectRoot = process.cwd()): SeparationAuditSnapshot {
  const routeInventory = collectApiSurfaceInventory(projectRoot);
  const byDomain: Record<SeparationDomain, number> = {
    product: 0,
    "control-plane": 0,
    factory: 0,
    legacy: 0,
  };

  for (const row of routeInventory) {
    byDomain[row.domain] += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    contractsCatalog: CONTROL_PLANE_CONTRACT_NAMES,
    routeSummary: {
      total: routeInventory.length,
      byDomain,
    },
    blockedSignals: collectBlockedSignals(projectRoot),
  };
}

export function writeSeparationAuditArtifacts(projectRoot = process.cwd()): {
  routeInventory: ApiSurfaceInventoryRow[];
  runtimeMatrix: RuntimeTopologyRow[];
  auditSnapshot: SeparationAuditSnapshot;
} {
  const routeInventory = collectApiSurfaceInventory(projectRoot);
  const runtimeMatrix = collectRuntimeTopologyMatrix(projectRoot);
  const auditSnapshot = collectSeparationAuditSnapshot(projectRoot);

  fs.writeFileSync(DEFAULT_ROUTE_OUTPUT, `${JSON.stringify(routeInventory, null, 2)}\n`, "utf8");
  fs.writeFileSync(DEFAULT_RUNTIME_OUTPUT, `${JSON.stringify(runtimeMatrix, null, 2)}\n`, "utf8");
  fs.writeFileSync(DEFAULT_AUDIT_OUTPUT, `${JSON.stringify(auditSnapshot, null, 2)}\n`, "utf8");

  return { routeInventory, runtimeMatrix, auditSnapshot };
}
