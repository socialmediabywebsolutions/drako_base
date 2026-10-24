import { resolveSocialContext, SocialContextError } from "@/lib/socialflow/repository";
import type { SocialAudit } from "@/lib/socialflow/audit/types";

const SOCIALFLOW_AUDITS_TABLE = "socialflow_audits";
const DEFAULT_SAAS_ID = "socialflow";

type AuditRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  score: number;
  area_scores_json: string | null;
  strengths_json: string | null;
  weaknesses_json: string | null;
  opportunities_json: string | null;
  recommendations_json: string | null;
  competitor_comparison_json: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

function nowIso() {
  return new Date().toISOString();
}

function generateId() {
  try {
    if (globalThis.crypto?.randomUUID) return `sf_audit_${globalThis.crypto.randomUUID()}`;
  } catch {
    // ignore and fallback
  }
  return `sf_audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseJsonArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function serializeJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

function ensureAuditsTable(db: D1Database) {
  return Promise.all([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS ${SOCIALFLOW_AUDITS_TABLE} (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        saas_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        area_scores_json TEXT,
        strengths_json TEXT,
        weaknesses_json TEXT,
        opportunities_json TEXT,
        recommendations_json TEXT,
        competitor_comparison_json TEXT,
        summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(tenant_id, saas_id)
      )`,
    ).run(),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_${SOCIALFLOW_AUDITS_TABLE}_tenant_saas
       ON ${SOCIALFLOW_AUDITS_TABLE} (tenant_id, saas_id)`,
    ).run(),
  ]);
}

function mapRowToAudit(row: AuditRow): SocialAudit {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    score: row.score,
    areaScores: parseJsonArray(row.area_scores_json),
    strengths: parseJsonArray(row.strengths_json),
    weaknesses: parseJsonArray(row.weaknesses_json),
    opportunities: parseJsonArray(row.opportunities_json),
    recommendations: parseJsonArray(row.recommendations_json),
    competitorComparison: parseJsonArray(row.competitor_comparison_json),
    summary: row.summary ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getLatestAudit(tenantId: string, saasId = DEFAULT_SAAS_ID): Promise<SocialAudit | null> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureAuditsTable(context.socialDb);

  const result = await context.socialDb
    .prepare(`SELECT * FROM ${SOCIALFLOW_AUDITS_TABLE} WHERE tenant_id = ? AND saas_id = ? LIMIT 1`)
    .bind(context.tenantId, context.saasId ?? saasId)
    .all<AuditRow>();

  const row = result.results?.[0] ?? null;
  return row ? mapRowToAudit(row) : null;
}

export async function upsertAudit(
  tenantId: string,
  audit: Omit<SocialAudit, "id" | "tenantId" | "saasId" | "createdAt" | "updatedAt">,
  saasId = DEFAULT_SAAS_ID,
): Promise<SocialAudit> {
  const context = await resolveSocialContext({ tenantId, saasId });
  await ensureAuditsTable(context.socialDb);

  const existing = await getLatestAudit(tenantId, saasId);
  const id = existing?.id ?? generateId();
  const createdAt = existing?.createdAt ?? nowIso();
  const updatedAt = nowIso();

  await context.socialDb
    .prepare(
      `INSERT INTO ${SOCIALFLOW_AUDITS_TABLE} (
        id, tenant_id, saas_id, score, area_scores_json, strengths_json, weaknesses_json, opportunities_json,
        recommendations_json, competitor_comparison_json, summary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, saas_id) DO UPDATE SET
        score = excluded.score,
        area_scores_json = excluded.area_scores_json,
        strengths_json = excluded.strengths_json,
        weaknesses_json = excluded.weaknesses_json,
        opportunities_json = excluded.opportunities_json,
        recommendations_json = excluded.recommendations_json,
        competitor_comparison_json = excluded.competitor_comparison_json,
        summary = excluded.summary,
        updated_at = excluded.updated_at`,
    )
    .bind(
      id,
      tenantId,
      saasId,
      Math.round(audit.score),
      serializeJson(audit.areaScores),
      serializeJson(audit.strengths),
      serializeJson(audit.weaknesses),
      serializeJson(audit.opportunities),
      serializeJson(audit.recommendations),
      serializeJson(audit.competitorComparison),
      audit.summary,
      createdAt,
      updatedAt,
    )
    .run();

  const stored = await getLatestAudit(tenantId, saasId);
  if (!stored) {
    throw new SocialContextError("Unable to persist SocialFlow audit.");
  }
  return stored;
}
