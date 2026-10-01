import { env } from "@/lib/cf";
import type { FundingOpportunityInput } from "@/lib/drako/funding-generator";

// Lectura/escritura de drako_funding_opportunities (DRACO_DB, migración 0207). La usan
// /api/funding/opportunities y /api/cron/funding.

export const FUNDING_PAGE_SIZE = 20;
export const FUNDING_STATUSES = ["nueva", "en proceso", "descartada"] as const;

export type FundingOpportunity = {
  id: number;
  title: string;
  organism: string;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  url: string | null;
  tags: string[];
  source: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type FundingRow = Omit<FundingOpportunity, "tags"> & { tags: string | null };

function requireDb(): D1Database {
  const db = env()?.DRACO_DB;
  if (!db) throw new Error("DRACO_DB not configured");
  return db;
}

function parseTags(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export async function listFundingOpportunities(page: number): Promise<{
  items: FundingOpportunity[];
  page: number;
  totalPages: number;
  total: number;
}> {
  const db = requireDb();
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const [countRow, rows] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS total FROM drako_funding_opportunities`).first<{ total: number }>(),
    db
      .prepare(
        `SELECT id, title, organism, description, amount_min, amount_max, deadline, url, tags, source, status, created_at, updated_at
         FROM drako_funding_opportunities
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(FUNDING_PAGE_SIZE, (safePage - 1) * FUNDING_PAGE_SIZE)
      .all<FundingRow>(),
  ]);
  const total = Number(countRow?.total ?? 0);
  return {
    items: (rows.results ?? []).map((row) => ({ ...row, tags: parseTags(row.tags) })),
    page: safePage,
    totalPages: Math.max(1, Math.ceil(total / FUNDING_PAGE_SIZE)),
    total,
  };
}

// Inserta solo las que no existen ya (mismo título + organismo): el cron semanal y
// "Ejecutar ahora" pueden repetir oportunidades sin duplicar filas.
export async function insertFundingOpportunities(items: FundingOpportunityInput[]): Promise<number> {
  if (!items.length) return 0;
  const db = requireDb();
  const results = await db.batch(
    items.map((item) =>
      db
        .prepare(
          `INSERT INTO drako_funding_opportunities
             (title, organism, description, amount_min, amount_max, deadline, url, tags, source, status)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nueva'
           WHERE NOT EXISTS (
             SELECT 1 FROM drako_funding_opportunities WHERE title = ? AND organism = ?
           )`,
        )
        .bind(
          item.title,
          item.organism,
          item.description,
          item.amount_min,
          item.amount_max,
          item.deadline,
          item.url,
          JSON.stringify(item.tags),
          item.source,
          item.title,
          item.organism,
        ),
    ),
  );
  return results.reduce((sum, r) => sum + Number((r.meta as { changes?: number } | undefined)?.changes ?? 0), 0);
}

export async function discardFundingOpportunity(id: number): Promise<boolean> {
  const result = await requireDb()
    .prepare(`UPDATE drako_funding_opportunities SET status = 'descartada', updated_at = datetime('now') WHERE id = ?`)
    .bind(id)
    .run();
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}

// Valida el cuerpo del POST: array de oportunidades con title y organism.
export function parseFundingInput(body: unknown): FundingOpportunityInput[] | null {
  if (!Array.isArray(body)) return null;
  const items: FundingOpportunityInput[] = [];
  for (const raw of body) {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
    const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
    const title = str(r.title);
    const organism = str(r.organism);
    if (!title || !organism) return null;
    items.push({
      title,
      organism,
      description: str(r.description) ?? "",
      amount_min: int(r.amount_min),
      amount_max: int(r.amount_max),
      deadline: str(r.deadline),
      url: str(r.url) ?? "",
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      source: str(r.source) ?? "manual",
    });
  }
  return items;
}
