import { resolveSocialContext } from "@/lib/socialflow/repository";

const TABLE = "socialflow_knowledge_documents";
const MAX_CONTENT_CHARS = 50_000;
const CONTEXT_DOCS = 5;
const CONTEXT_SNIPPET = 800;

export type KnowledgeDoc = {
  id: string;
  tenant_id: string;
  saas_id: string;
  name: string;
  type: "pdf" | "url" | "text";
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

export async function deleteKnowledgeDoc(
  id: string,
  tenantId: string,
  saasId: string,
): Promise<boolean> {
  const db = await getDb(tenantId, saasId);
  const { meta } = await db
    .prepare(`DELETE FROM ${TABLE} WHERE id = ? AND tenant_id = ? AND saas_id = ?`)
    .bind(id, tenantId, saasId)
    .run();
  return (meta.changes ?? 0) > 0;
}

// Returns a concise context string for injection into AI prompts.
export async function getKnowledgeContext(
  tenantId: string,
  saasId: string,
): Promise<string> {
  const db = await getDb(tenantId, saasId);
  const { results } = await db
    .prepare(
      `SELECT name, content_text
       FROM ${TABLE}
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(tenantId, saasId, CONTEXT_DOCS)
    .all<{ name: string; content_text: string }>();

  if (!results?.length) return "";

  return results
    .map((doc) => `[${doc.name}]\n${doc.content_text.slice(0, CONTEXT_SNIPPET)}`)
    .join("\n\n---\n\n");
}
