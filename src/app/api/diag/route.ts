import { NextResponse } from "next/server";
import { ensureDatabase, queryAll, DatabaseUnavailableError } from "@/lib/db";
import { ensureCampamentoBase, getCampamentoCoreAgentsCatalog, getCampamentoCoreDepartmentsCatalog } from "@/lib/campamento-base";
export const runtime = "edge";


const REQUIRED_TABLES = ["saas", "saas_domains", "saas_projects", "owners", "clients", "campamento_events"];
const SEED_CHECKS = [
  { table: "saas", slug: "drako-systems" },
  { table: "saas_domains", domain: "drako.systems" },
];

async function getTableExists(name: string) {
  const rows = await queryAll<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    name,
  );
  return rows.length > 0;
}

async function getSeedStatus() {
  const seeds: Record<string, boolean> = {};
  for (const check of SEED_CHECKS) {
    if (check.slug) {
      const rows = await queryAll("SELECT slug FROM saas WHERE slug = ? LIMIT 1", check.slug);
      seeds[`saas:${check.slug}`] = rows.length > 0;
    }
    if (check.domain) {
      const rows = await queryAll("SELECT domain FROM saas_domains WHERE domain = ? LIMIT 1", check.domain);
      seeds[`domain:${check.domain}`] = rows.length > 0;
    }
  }
  return seeds;
}

export async function GET() {
  const correlationId = globalThis.crypto?.randomUUID?.() ?? `diag_${Date.now()}`;
  try {
    ensureDatabase();
    await ensureCampamentoBase();
  } catch (error) {
    const reason =
      error instanceof DatabaseUnavailableError
        ? error.reason
        : error instanceof Error
          ? error.message
          : String(error);
    const bindingDetails =
      error instanceof DatabaseUnavailableError && error.reason === "binding-missing"
        ? {
            bindingName: "DRACO_DB",
            action:
              "Configure D1 binding in Cloudflare Pages: Project -> Settings -> Functions -> D1 bindings.",
          }
        : {};
    console.error("DIAG_DB_UNAVAILABLE", { correlationId, reason });
    return NextResponse.json(
      { ok: false, correlationId, db: { status: "unavailable", reason }, ...bindingDetails },
      { status: 503 },
    );
  }

  const tables: Record<string, boolean> = {};
  for (const t of REQUIRED_TABLES) {
    try {
      tables[t] = await getTableExists(t);
    } catch (error) {
      tables[t] = false;
      console.error("DIAG_TABLE_ERROR", { correlationId, table: t, error });
    }
  }

  let seeds: Record<string, boolean> = {};
  try {
    seeds = await getSeedStatus();
  } catch (error) {
    console.error("DIAG_SEED_ERROR", { correlationId, error });
  }

  const missing = Object.entries(tables)
    .filter(([, exists]) => !exists)
    .map(([name]) => name);

  const coreDepartmentsCatalog = getCampamentoCoreDepartmentsCatalog();
  const coreAgentsCatalog = getCampamentoCoreAgentsCatalog();
  let coreDepartments: Array<{ slug: string }> = [];
  let coreAgents: Array<{ slug: string }> = [];
  try {
    coreDepartments = await queryAll("SELECT slug FROM core_departments");
    coreAgents = await queryAll("SELECT slug FROM core_agents");
  } catch (error) {
    console.error("DIAG_CORE_CATALOG_ERROR", { correlationId, error });
  }

  const existingDepartmentSlugs = new Set(coreDepartments.map((dept) => dept.slug));
  const existingAgentSlugs = new Set(coreAgents.map((agent) => agent.slug));
  const missingCoreDepartments = coreDepartmentsCatalog
    .map((dept) => dept.slug)
    .filter((slug) => !existingDepartmentSlugs.has(slug));
  const missingCoreAgents = coreAgentsCatalog
    .map((agent) => agent.slug)
    .filter((slug) => !existingAgentSlugs.has(slug));

  const coreCatalogSnapshot = {
    departmentsCount: coreDepartments.length,
    agentsCount: coreAgents.length,
  };

  const recommendations: string[] = [];
  if (missing.length > 0) recommendations.push("Apply D1 migrations.");
  if (missingCoreDepartments.length > 0 || missingCoreAgents.length > 0) {
    recommendations.push("Run ensureCampamentoBase / seed core catalog.");
  }
  if (Object.values(seeds).some((value) => !value)) recommendations.push("Insert demo seed records.");
  if (recommendations.length === 0) recommendations.push("DB schema looks present; verify data if endpoints still fail.");

  return NextResponse.json({
    ok: missing.length === 0 && missingCoreDepartments.length === 0 && missingCoreAgents.length === 0,
    correlationId,
    db: {
      tables,
      missing,
      seeds,
    },
    coreCatalogSnapshot,
    missingCoreDepartments,
    missingCoreAgents,
    recommendation: recommendations.join(" "),
  });
}
