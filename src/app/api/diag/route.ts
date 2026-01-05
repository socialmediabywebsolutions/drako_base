import { NextResponse } from "next/server";
import { ensureDatabase, queryAll, DatabaseUnavailableError } from "@/lib/db";

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
  } catch (error) {
    const reason =
      error instanceof DatabaseUnavailableError
        ? error.reason
        : error instanceof Error
          ? error.message
          : String(error);
    console.error("DIAG_DB_UNAVAILABLE", { correlationId, reason });
    return NextResponse.json(
      { ok: false, correlationId, db: { status: "unavailable", reason } },
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

  return NextResponse.json({
    ok: missing.length === 0,
    correlationId,
    db: {
      tables,
      missing,
      seeds,
    },
    recommendation:
      missing.length > 0
        ? "Apply D1 migrations and seed demo records."
        : "DB schema looks present; verify data if endpoints still fail.",
  });
}
