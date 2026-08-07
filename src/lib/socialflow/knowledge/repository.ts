import { resolveSocialContext } from "@/lib/socialflow/repository";

const TABLE = "socialflow_knowledge_documents";
const MAX_CONTENT_CHARS = 50_000;
const CONTEXT_DOCS = 5;
const CONTEXT_SNIPPET = 800;
const CATALOG_CONTEXT_DOCS = 3;
const CATALOG_CONTEXT_SNIPPET = 3000;

export type KnowledgeDocType = "pdf" | "url" | "text" | "catalog" | "competitor" | "market_analysis" | "auto_learned_style" | "voice_profile";

export type KnowledgeDoc = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  type: KnowledgeDocType;
  content_text: string;
  source_url: string | null;
  created_at: string;
};

async function getDb(tenantId: string, saasId: string) {
  const ctx = await resolveSocialContext({ tenantId, saasId });
  return ctx.socialDb;
}

export async function listKnowledgeDocs(
  tenantId: string,
  saasId: string,
): Promise<Omit<KnowledgeDoc, "content_text">[]> {
  const db = await getDb(tenantId, saasId);
  const { results } = await db
    .prepare(
      `SELECT id, tenant_id, saas_id, name, type, source_url, created_at
       FROM ${TABLE}
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC
       LIMIT 100`,
    )
    .bind(tenantId, saasId)
    .all<Omit<KnowledgeDoc, "content_text">>();
  return results ?? [];
}

export async function saveKnowledgeDoc(params: {
  tenantId: string;
  saasId: string;
  name: string;
  type: KnowledgeDoc["type"];
  contentText: string;
  sourceUrl?: string | null;
}): Promise<KnowledgeDoc> {
  const db = await getDb(params.tenantId, params.saasId);
  const id = crypto.randomUUID();
  const content = params.contentText.slice(0, MAX_CONTENT_CHARS);
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO ${TABLE} (id, tenant_id, saas_id, name, type, content_text, source_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, params.tenantId, params.saasId, params.name, params.type, content, params.sourceUrl ?? null, now)
    .run();
  return {
    id,
    tenant_id: params.tenantId,
    saas_id: params.saasId,
    name: params.name,
    type: params.type,
    content_text: content,
    source_url: params.sourceUrl ?? null,
    created_at: now,
  };
}

// Upserts a singleton document per (tenant, saas, type) — used for auto-generated docs
// (e.g. "auto_learned_style") that should be overwritten on every run instead of
// accumulating one row per run like manual uploads/URLs do.
export async function upsertKnowledgeDocByType(params: {
  tenantId: string;
  saasId: string;
  name: string;
  type: KnowledgeDoc["type"];
  contentText: string;
  sourceUrl?: string | null;
}): Promise<KnowledgeDoc> {
  const db = await getDb(params.tenantId, params.saasId);
  const content = params.contentText.slice(0, MAX_CONTENT_CHARS);
  const existing = await db
    .prepare(
      `SELECT id, created_at FROM ${TABLE} WHERE tenant_id = ? AND saas_id = ? AND type = ? LIMIT 1`,
    )
    .bind(params.tenantId, params.saasId, params.type)
    .first<{ id: string; created_at: string }>();

  const now = new Date().toISOString();

  if (existing) {
    await db
      .prepare(
        `UPDATE ${TABLE} SET name = ?, content_text = ?, source_url = ?, created_at = ? WHERE id = ?`,
      )
      .bind(params.name, content, params.sourceUrl ?? null, now, existing.id)
      .run();
    return {
      id: existing.id,
      tenant_id: params.tenantId,
      saas_id: params.saasId,
      name: params.name,
      type: params.type,
      content_text: content,
      source_url: params.sourceUrl ?? null,
      created_at: now,
    };
  }

  return saveKnowledgeDoc(params);
}

export async function deleteKnowledgeDoc(
  id: string,
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  const db = await getDb(tenantId, saasId);
  const result = await db
    .prepare(`DELETE FROM ${TABLE} WHERE id = ? AND tenant_id = ? AND saas_id = ?`)
    .bind(id, tenantId, saasId)
    .run();
  return ((result?.meta as { changes?: number })?.changes ?? 0) > 0;
}

// Returns a structured context string for injection into AI prompts.
// Sections: market analysis → competitor intelligence → brand knowledge base.
export async function getKnowledgeContext(
  tenantId: string,
  saasId: string,
): Promise<string> {
  const db = await getDb(tenantId, saasId);
  const { results } = await db
    .prepare(
      `SELECT name, type, content_text
       FROM ${TABLE}
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    .bind(tenantId, saasId)
    .all<{ name: string; type: string; content_text: string }>();

  if (!results?.length) return "";

  const styleDocs = results.filter((d) => d.type === "auto_learned_style").slice(0, 1);
  const voiceDocs = results.filter((d) => d.type === "voice_profile").slice(0, 1);
  const marketDocs = results.filter((d) => d.type === "market_analysis").slice(0, 1);
  const competitorDocs = results.filter((d) => d.type === "competitor").slice(0, 5);
  const catalogDocs = results.filter((d) => d.type === "catalog").slice(0, CATALOG_CONTEXT_DOCS);
  const knowledgeDocs = results
    .filter(
      (d) =>
        d.type !== "market_analysis" &&
        d.type !== "competitor" &&
        d.type !== "auto_learned_style" &&
        d.type !== "voice_profile" &&
        d.type !== "catalog",
    )
    .slice(0, CONTEXT_DOCS);

  const parts: string[] = [];

  if (styleDocs.length) {
    parts.push(`## LEARNED WRITING STYLE (from this account's own published posts)\n${styleDocs[0].content_text.slice(0, 2000)}`);
  }

  if (voiceDocs.length) {
    parts.push(`## VOZ REAL DEL CLIENTE (extraída de sus propios posts publicados)\n${voiceDocs[0].content_text.slice(0, 1500)}`);
  }

  if (marketDocs.length) {
    parts.push(`## MARKET INTELLIGENCE\n${marketDocs[0].content_text.slice(0, 2000)}`);
  }

  if (competitorDocs.length) {
    const section = competitorDocs
      .map((d) => `[${d.name}]\n${d.content_text.slice(0, CONTEXT_SNIPPET)}`)
      .join("\n\n");
    parts.push(`## COMPETITOR INTELLIGENCE\n${section}`);
  }

  if (catalogDocs.length) {
    const section = catalogDocs
      .map((d) => `[${d.name}]\n${d.content_text.slice(0, CATALOG_CONTEXT_SNIPPET)}`)
      .join("\n\n---\n\n");
    parts.push(`## PRODUCT CATALOG\n${section}`);
  }

  if (knowledgeDocs.length) {
    const section = knowledgeDocs
      .map((d) => `[${d.name}]\n${d.content_text.slice(0, CONTEXT_SNIPPET)}`)
      .join("\n\n---\n\n");
    parts.push(`## BRAND KNOWLEDGE BASE\n${section}`);
  }

  return parts.join("\n\n===\n\n");
}
