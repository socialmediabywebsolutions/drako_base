import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Guardarraíl P1 del plan de independencia de SocialCors.
 *
 * Recorre el grafo de imports desde las entradas reales de SocialCors (page,
 * layout, route… de Next.js y el `main` del Worker IA) y congela el conjunto de ficheros FUERA del
 * dominio SocialCors que ese código alcanza (directa o transitivamente).
 *
 * - Un fichero externo nuevo en el cierre hace fallar el test. Si es un
 *   acoplamiento al holding (@/lib/drako, @/lib/operator, …) no debe añadirse:
 *   hay que usar el contrato interno o código propio de SocialCors.
 * - Una entrada de la baseline que ya no se alcanza también hace fallar el
 *   test, para que la baseline solo pueda encoger (ratchet).
 *
 * Regenerar la lista actual: SOCIALCORS_PRINT_BASELINE=1 npx vitest run tests/architecture/socialcors-forbidden-imports.test.ts
 */

const repoRoot = process.cwd();

// Rutas de Next.js que sirve SocialCors.
const APP_ROUTE_DIRS = [
  "src/app/socialflows",
  "src/app/socialflow",
  "src/app/api/socialflow",
  "src/app/api/cron/social",
  "src/app/api/internal/socialflow",
  "src/app/api/social",
  "src/app/auth/linkedin",
  "src/app/privacidad/datos-eliminados",
] as const;

// Ficheros que Next.js ejecuta por convención; el resto (p. ej. _components) solo cuenta si se importa.
const NEXT_ENTRY_FILE_PATTERN =
  /\/(?:page|layout|route|loading|error|global-error|not-found|template|default)\.[cm]?[jt]sx?$/;

// `main` de workers/socialflow-ai-worker/wrangler.workers.toml.
const WORKER_ENTRIES = ["workers/socialflow-ai-worker/src/index.ts"] as const;

// Dominio SocialCors: lo que se lleva el futuro repo. Todo lo demás es externo.
const DOMAIN_DIRS = [
  ...APP_ROUTE_DIRS,
  "workers/socialflow-ai-worker/src",
  "src/lib/socialflow",
  "src/lib/social-core",
  "src/components/socialflow",
] as const;

// Módulos del holding: nunca deben entrar en el cierre de SocialCors salvo deuda ya registrada.
const FORBIDDEN_HOLDING_PREFIXES = [
  "src/lib/drako/",
  "src/lib/operator/",
  "src/lib/owner/",
  "src/lib/admin/",
  "src/lib/campamento-base/",
  "src/lib/campobase/",
  "src/lib/factory/",
  "src/lib/provisioning/",
  "src/lib/orchestrator/",
  "src/lib/supervisor/",
  "src/lib/economy/",
  "src/lib/appointments/",
  "src/lib/employees/",
  "src/lib/customers/",
  "src/lib/packs/",
  "src/lib/integration-core/",
  "src/lib/observability-core/",
  "src/lib/empire/",
  "src/lib/auth/session.ts",
  "src/lib/auth/campamento-core.ts",
] as const;

const PATH_ALIASES: Array<[prefix: string, target: string]> = [
  ["@/", "src/"],
  ["@shared-neutral/", "packages/shared-neutral/src/"],
  ["@shared-cloudflare/", "packages/shared-cloudflare/src/"],
  ["@shared-ui-neutral/", "packages/shared-ui-neutral/src/"],
];

const CODE_FILE_PATTERN = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^'"]*?\sfrom\s*["']([^"']+)["']/g,
  /\bimport\s*["']([^"']+)["']/g,
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
];

/**
 * Ficheros externos que SocialCors alcanza hoy (deuda conocida).
 * Esta lista solo debe encoger. Cada fase del plan (P2, P5–P10) retira entradas.
 */
const EXTERNAL_BASELINE: readonly string[] = [
  "src/components/legal/legal-data.ts",
  "src/components/settings/socialflow-account-settings.tsx",
  "src/components/settings/socialflow-billing-settings.tsx",
  "src/lib/admin/demo-data.ts",
  "src/lib/ai/usage.ts",
  "src/lib/appointments/repository.ts",
  "src/lib/appointments/types.ts",
  "src/lib/auth/campamento-core.ts",
  "src/lib/auth/crypto.ts",
  "src/lib/auth/platform-admin-allowlist.ts",
  "src/lib/auth/session.ts",
  "src/lib/auths/contexts.ts",
  "src/lib/auths/cookies.ts",
  "src/lib/auths/factories.ts",
  "src/lib/auths/flags.ts",
  "src/lib/auths/http.ts",
  "src/lib/auths/repositories.ts",
  "src/lib/auths/services.ts",
  "src/lib/auths/socialflow-auths.ts",
  "src/lib/auths/ssot.ts",
  "src/lib/auths/tokens.ts",
  "src/lib/auths/types.ts",
  "src/lib/billing/subscriptions.ts",
  "src/lib/capabilities/internal-api-auth/service-token.ts",
  "src/lib/capabilities/internal-api-types/socialflow.ts",
  "src/lib/cf.ts",
  "src/lib/cloudflare/runtime.ts",
  "src/lib/conversations/types.ts",
  "src/lib/correlation.ts",
  "src/lib/customers/types.ts",
  "src/lib/db.ts",
  "src/lib/drako/operator-session.ts",
  "src/lib/economy/repository.ts",
  "src/lib/economy/types.ts",
  "src/lib/email.ts",
  "src/lib/empire/events.ts",
  "src/lib/employees/compliance.ts",
  "src/lib/employees/context.ts",
  "src/lib/employees/repository.ts",
  "src/lib/employees/types.ts",
  "src/lib/export/wipeout-package.ts",
  "src/lib/google-places-client.ts",
  "src/lib/hosts.ts",
  "src/lib/http/base-url.ts",
  "src/lib/http/errors.ts",
  "src/lib/integration-core/connections.ts",
  "src/lib/integration-core/definitions.ts",
  "src/lib/integration-core/execution.ts",
  "src/lib/integration-core/index.ts",
  "src/lib/integration-core/providers.ts",
  "src/lib/integration-core/providers/linkedin.ts",
  "src/lib/integration-core/shared.ts",
  "src/lib/integration-core/types.ts",
  "src/lib/observability-core/activities.ts",
  "src/lib/observability-core/health.ts",
  "src/lib/observability-core/incidents.ts",
  "src/lib/observability-core/index.ts",
  "src/lib/observability-core/shared.ts",
  "src/lib/observability-core/summary.ts",
  "src/lib/observability-core/types.ts",
  "src/lib/owner/vendor-types.ts",
  "src/lib/packs/definitions.ts",
  "src/lib/packs/types.ts",
  "src/lib/platform/surfaces.ts",
  "src/lib/saas/marketing-packs.ts",
  "src/lib/saas/marketing-types.ts",
  "src/lib/security/cron-auth.ts",
  "src/lib/security/cron-lock.ts",
  "src/lib/stripe/rest.ts",
  "src/lib/tenants/services.ts",
];

function toRepoPath(absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function listCodeFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(repoRoot, relativeDir);
  if (!existsSync(absoluteDir)) return [];

  return readdirSync(absoluteDir).flatMap((entry) => {
    const fullPath = path.join(absoluteDir, entry);
    const relativePath = path.join(relativeDir, entry);
    if (statSync(fullPath).isDirectory()) return listCodeFiles(relativePath);
    if (!CODE_FILE_PATTERN.test(entry) || TEST_FILE_PATTERN.test(entry)) return [];
    return [toRepoPath(fullPath)];
  });
}

function resolveFile(candidate: string): string | null {
  const attempts = [
    candidate,
    ...RESOLVE_EXTENSIONS.map((extension) => `${candidate}${extension}`),
    ...RESOLVE_EXTENSIONS.map((extension) => path.join(candidate, `index${extension}`)),
  ];
  for (const attempt of attempts) {
    const absolutePath = path.join(repoRoot, attempt);
    if (existsSync(absolutePath) && statSync(absolutePath).isFile()) return toRepoPath(absolutePath);
  }
  return null;
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith(".")) {
    return resolveFile(path.join(path.dirname(fromFile), specifier));
  }
  for (const [prefix, target] of PATH_ALIASES) {
    if (specifier.startsWith(prefix)) return resolveFile(target + specifier.slice(prefix.length));
  }
  return null; // paquete npm
}

function extractSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  for (const pattern of IMPORT_PATTERNS) {
    for (const match of source.matchAll(pattern)) specifiers.add(match[1]);
  }
  return [...specifiers];
}

function isDomainFile(file: string): boolean {
  return DOMAIN_DIRS.some((dir) => file === dir || file.startsWith(`${dir}/`));
}

function isForbiddenHoldingFile(file: string): boolean {
  return FORBIDDEN_HOLDING_PREFIXES.some((prefix) => file.startsWith(prefix));
}

type ImportGraph = {
  entries: string[];
  externalFiles: string[];
  importedBy: Map<string, string>;
};

function buildImportGraph(): ImportGraph {
  const entries = [
    ...APP_ROUTE_DIRS.flatMap((dir) => listCodeFiles(dir)).filter((file) => NEXT_ENTRY_FILE_PATTERN.test(file)),
    ...WORKER_ENTRIES,
  ];
  const visited = new Set<string>(entries);
  const importedBy = new Map<string, string>();
  const queue = [...entries];

  while (queue.length > 0) {
    const file = queue.shift()!;
    if (!CODE_FILE_PATTERN.test(file)) continue;
    const source = readFileSync(path.join(repoRoot, file), "utf8");

    for (const specifier of extractSpecifiers(source)) {
      const resolved = resolveSpecifier(file, specifier);
      if (!resolved || visited.has(resolved)) continue;
      visited.add(resolved);
      importedBy.set(resolved, file);
      queue.push(resolved);
    }
  }

  const externalFiles = [...visited]
    .filter((file) => CODE_FILE_PATTERN.test(file) && !isDomainFile(file))
    .sort();

  return { entries, externalFiles, importedBy };
}

function importChain(graph: ImportGraph, file: string): string {
  const chain = [file];
  let current = graph.importedBy.get(file);
  while (current) {
    chain.unshift(current);
    current = graph.importedBy.get(current);
  }
  return chain.join(" → ");
}

describe("SocialCors: guardarraíl de imports hacia el holding (P1)", () => {
  const graph = buildImportGraph();

  if (process.env.SOCIALCORS_PRINT_BASELINE === "1") {
    console.log(JSON.stringify(graph.externalFiles, null, 2));
  }

  it("encuentra las entradas de SocialCors", () => {
    expect(graph.entries.length).toBeGreaterThan(100);
    expect(graph.entries).toContain("workers/socialflow-ai-worker/src/index.ts");
  });

  it("la baseline está ordenada y sin duplicados", () => {
    expect([...EXTERNAL_BASELINE]).toEqual([...new Set(EXTERNAL_BASELINE)].sort());
  });

  it("no añade acoplamientos nuevos a módulos del holding", () => {
    const baseline = new Set(EXTERNAL_BASELINE);
    const violations = graph.externalFiles
      .filter((file) => isForbiddenHoldingFile(file) && !baseline.has(file))
      .map((file) => importChain(graph, file));

    expect(
      violations,
      "SocialCors no puede depender de módulos del holding. Usa el contrato interno (/api/internal/socialflow/*) o código propio en src/lib/socialflow.",
    ).toEqual([]);
  });

  it("no añade dependencias externas nuevas fuera de la baseline", () => {
    const baseline = new Set(EXTERNAL_BASELINE);
    const additions = graph.externalFiles
      .filter((file) => !isForbiddenHoldingFile(file) && !baseline.has(file))
      .map((file) => importChain(graph, file));

    expect(
      additions,
      "Dependencia externa nueva. Mueve o copia el código a src/lib/socialflow; solo si es una decisión deliberada, añádela a EXTERNAL_BASELINE.",
    ).toEqual([]);
  });

  it("la baseline solo encoge: retira las entradas que ya no se alcanzan", () => {
    const reachable = new Set(graph.externalFiles);
    const stale = EXTERNAL_BASELINE.filter((file) => !reachable.has(file));

    expect(stale, "Estas dependencias ya no se usan: elimínalas de EXTERNAL_BASELINE.").toEqual([]);
  });
});
