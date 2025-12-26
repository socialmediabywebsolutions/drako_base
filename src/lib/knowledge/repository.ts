import { env as resolveEnv, type DracoEnv } from "@/lib/cf";
import { queryAll, run } from "@/lib/db";
import {
  createDemoKnowledgeDocument,
  createDemoKnowledgeSpace,
  createDemoKnowledgeLink,
  getDemoKnowledgeDocumentById,
  listDemoKnowledgeDocuments,
  listDemoKnowledgeDocumentsForTarget,
  listDemoKnowledgeSpaces,
  listDemoKnowledgeLinksForDocument,
  listDemoKnowledgeLinksForTarget,
  deleteDemoKnowledgeLink,
  updateDemoKnowledgeDocument,
} from "@/lib/admin/demo-data";
import type { DemoKnowledgeDocument, DemoKnowledgeLink, DemoKnowledgeSpace } from "@/lib/admin/demo-data";
import type {
  CreateKnowledgeDocumentInput,
  CreateKnowledgeLinkInput,
  CreateKnowledgeSpaceInput,
  KnowledgeSearchParams,
  SaasKnowledgeDocument,
  SaasKnowledgeDocumentStatus,
  SaasKnowledgeDocumentType,
  SaasKnowledgeLink,
  SaasKnowledgeLinkTargetType,
  SaasKnowledgeSpace,
  UpdateKnowledgeDocumentInput,
} from "@/lib/knowledge/types";
import { DEMO_TENANT_ID } from "@/lib/tenants/services";

export type KnowledgeContextMode = "d1" | "demo";

export type KnowledgeContext = {
  tenantId: string;
  saasId: string | null;
  mode: KnowledgeContextMode;
  allowDemoFallback: boolean;
  demoTenantId?: string;
  db?: D1Database;
  env?: DracoEnv | null;
};

export class KnowledgeContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KnowledgeContextError";
  }
}

type SpaceRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  slug: string;
  label: string;
  description: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  space_id: string | null;
  title: string;
  type: string;
  source: string;
  status: string;
  audience: string;
  importance: string;
  summary: string | null;
  content: string;
  tags: string | null;
  created_by_employee_id: string | null;
  created_at: string;
  updated_at: string;
  metadata: string | null;
};

type LinkRow = {
  id: string;
  tenant_id: string;
  saas_id: string;
  document_id: string;
  target_type: string;
  target_id: string;
  created_at: string;
};

const FALLBACK_ERROR_PATTERNS = ["no such table", "no such column"];

function resolveEnvOverride(envOverride?: DracoEnv | null): DracoEnv | null {
  if (envOverride) return envOverride;
  return resolveEnv();
}

function hasDatabase(envOverride?: DracoEnv | null): boolean {
  return Boolean(resolveEnvOverride(envOverride)?.DRACO_DB);
}

function isDemoFeatureEnabled(tenantId: string, envOverride?: DracoEnv | null): boolean {
  if (tenantId === DEMO_TENANT_ID) return true;
  const runtimeEnv = resolveEnvOverride(envOverride);
  const flag = runtimeEnv?.DRAKO_DEMO_MODE ?? process.env.DRAKO_DEMO_MODE;
  return typeof flag === "string" && flag.toLowerCase() === "true";
}

function shouldFallbackToDemo(error: unknown, ctx: KnowledgeContext): boolean {
  if (ctx.mode !== "d1" || !ctx.allowDemoFallback) return false;
  const message = (error instanceof Error ? error.message : `${error ?? ""}`).toLowerCase();
  return FALLBACK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function generateUuid(): string {
  const globalCrypto = typeof globalThis !== "undefined" ? (globalThis.crypto as { randomUUID?: () => string } | undefined) : undefined;
  if (globalCrypto?.randomUUID) {
    try {
      return globalCrypto.randomUUID();
    } catch {
      // ignore and fallback
    }
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoTenantId(ctx: KnowledgeContext): string {
  return ctx.demoTenantId ?? ctx.tenantId;
}

function requireSaasId(ctx: KnowledgeContext): string {
  const saasId = ctx.saasId?.trim();
  if (!saasId) {
    throw new KnowledgeContextError("saasId is required for knowledge.");
  }
  return saasId;
}

function mapSpaceRow(row: SpaceRow): SaasKnowledgeSpace {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    slug: row.slug,
    label: row.label,
    description: row.description,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocumentRow(row: DocumentRow): SaasKnowledgeDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    spaceId: row.space_id,
    title: row.title,
    type: row.type as SaasKnowledgeDocumentType,
    source: row.source as SaasKnowledgeDocument["source"],
    status: row.status as SaasKnowledgeDocumentStatus,
    audience: row.audience as SaasKnowledgeDocument["audience"],
    importance: row.importance as SaasKnowledgeDocument["importance"],
    summary: row.summary,
    content: row.content,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : null,
    createdByEmployeeId: row.created_by_employee_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : null,
  };
}

function mapLinkRow(row: LinkRow): SaasKnowledgeLink {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    saasId: row.saas_id,
    documentId: row.document_id,
    targetType: row.target_type as SaasKnowledgeLinkTargetType,
    targetId: row.target_id,
    createdAt: row.created_at,
  };
}

function demoSpaceToRow(record: DemoKnowledgeSpace): SpaceRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    slug: record.slug,
    label: record.label,
    description: record.description,
    is_active: record.is_active,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function demoDocToRow(record: DemoKnowledgeDocument): DocumentRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    space_id: record.space_id,
    title: record.title,
    type: record.type,
    source: record.source,
    status: record.status,
    audience: record.audience,
    importance: record.importance,
    summary: record.summary,
    content: record.content,
    tags: record.tags,
    created_by_employee_id: record.created_by_employee_id,
    created_at: record.created_at,
    updated_at: record.updated_at,
    metadata: record.metadata,
  };
}

function demoLinkToRow(record: DemoKnowledgeLink): LinkRow {
  return {
    id: record.id,
    tenant_id: record.tenant_id,
    saas_id: record.saas_id,
    document_id: record.document_id,
    target_type: record.target_type,
    target_id: record.target_id,
    created_at: record.created_at,
  };
}

export async function resolveKnowledgeContext({
  tenantId,
  saasId,
  env,
}: {
  tenantId: string;
  saasId?: string | null;
  env?: DracoEnv | null;
}): Promise<KnowledgeContext> {
  const normalizedSaasId = saasId?.trim() ?? null;
  const demoEnabled = isDemoFeatureEnabled(tenantId, env);

  if (hasDatabase(env)) {
    const runtimeEnv = resolveEnvOverride(env);
    return {
      tenantId,
      saasId: normalizedSaasId,
      mode: "d1",
      allowDemoFallback: demoEnabled,
      demoTenantId: demoEnabled ? DEMO_TENANT_ID : undefined,
      db: runtimeEnv?.DRACO_DB,
      env: runtimeEnv,
    };
  }

  if (!demoEnabled) {
    throw new KnowledgeContextError("Knowledge module is not enabled for this tenant.");
  }

  return {
    tenantId,
    saasId: normalizedSaasId,
    mode: "demo",
    allowDemoFallback: true,
    demoTenantId: DEMO_TENANT_ID,
    env,
  };
}

export async function listKnowledgeSpaces(ctx: KnowledgeContext): Promise<SaasKnowledgeSpace[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    return listDemoKnowledgeSpaces(demoTenantId(ctx), saasId).map((row) => mapSpaceRow(demoSpaceToRow(row)));
  }
  try {
    const rows = await queryAll<SpaceRow>(
      `SELECT id, tenant_id, saas_id, slug, label, description, is_active, created_at, updated_at
       FROM saas_knowledge_spaces
       WHERE tenant_id = ? AND saas_id = ?
       ORDER BY label ASC`,
      ctx.tenantId,
      saasId,
    );
    return rows.map(mapSpaceRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      return listDemoKnowledgeSpaces(demoTenantId(ctx), saasId).map((row) => mapSpaceRow(demoSpaceToRow(row)));
    }
    throw error;
  }
}

export async function createKnowledgeSpace(ctx: KnowledgeContext, input: CreateKnowledgeSpaceInput): Promise<SaasKnowledgeSpace> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = generateUuid();
  const isActive = typeof input.isActive === "boolean" ? input.isActive : true;

  if (ctx.mode === "demo") {
    const record = createDemoKnowledgeSpace(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      slug: input.slug,
      label: input.label,
      description: input.description ?? null,
      is_active: isActive ? 1 : 0,
    });
    return mapSpaceRow(demoSpaceToRow(record));
  }

  await run(
    `INSERT INTO saas_knowledge_spaces (id, tenant_id, saas_id, slug, label, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    input.slug,
    input.label,
    input.description ?? null,
    isActive ? 1 : 0,
    now,
    now,
  );
  return {
    id,
    tenantId: ctx.tenantId,
    saasId,
    slug: input.slug,
    label: input.label,
    description: input.description ?? null,
    isActive,
    createdAt: now,
    updatedAt: now,
  };
}

export async function listKnowledgeDocuments(ctx: KnowledgeContext, params?: KnowledgeSearchParams): Promise<SaasKnowledgeDocument[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const docs = listDemoKnowledgeDocuments(demoTenantId(ctx), saasId, {
      spaceId: params?.spaceId ?? null,
      status: params?.status ?? null,
      tag: params?.tag ?? null,
      searchQuery: params?.searchQuery ?? null,
    }).map((row) => mapDocumentRow(demoDocToRow(row)));
    if (params?.targetType && params?.targetId) {
      const linked = listDemoKnowledgeDocumentsForTarget(demoTenantId(ctx), saasId, params.targetType, params.targetId)
        .map((row) => mapDocumentRow(demoDocToRow(row)));
      const ids = new Set(linked.map((doc) => doc.id));
      return docs.filter((doc) => ids.has(doc.id));
    }
    return docs;
  }
  try {
    const clauses: string[] = ["tenant_id = ?", "saas_id = ?"];
    const paramsList: unknown[] = [ctx.tenantId, saasId];
    if (params?.spaceId) {
      clauses.push("space_id = ?");
      paramsList.push(params.spaceId);
    }
    if (params?.status) {
      clauses.push("status = ?");
      paramsList.push(params.status);
    }
    if (params?.searchQuery) {
      clauses.push("(lower(title) LIKE ? OR lower(summary) LIKE ?)");
      const query = `%${params.searchQuery.toLowerCase()}%`;
      paramsList.push(query, query);
    }
    if (params?.targetType && params?.targetId) {
      clauses.push(
        "id IN (SELECT document_id FROM saas_knowledge_links WHERE tenant_id = ? AND saas_id = ? AND target_type = ? AND target_id = ?)",
      );
      paramsList.push(ctx.tenantId, saasId, params.targetType, params.targetId);
    }
    const rows = await queryAll<DocumentRow>(
      `SELECT id, tenant_id, saas_id, space_id, title, type, source, status, audience, importance, summary, content, tags,
              created_by_employee_id, created_at, updated_at, metadata
       FROM saas_knowledge_documents
       WHERE ${clauses.join(" AND ")}
       ORDER BY datetime(updated_at) DESC`,
      ...paramsList,
    );
    const docs = rows.map(mapDocumentRow);
    if (params?.tag) {
      return docs.filter((doc) => (doc.tags ?? []).includes(params.tag!));
    }
    return docs;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const docs = listDemoKnowledgeDocuments(demoTenantId(ctx), saasId, {
        spaceId: params?.spaceId ?? null,
        status: params?.status ?? null,
        tag: params?.tag ?? null,
        searchQuery: params?.searchQuery ?? null,
      }).map((row) => mapDocumentRow(demoDocToRow(row)));
      if (params?.targetType && params?.targetId) {
        const linked = listDemoKnowledgeDocumentsForTarget(demoTenantId(ctx), saasId, params.targetType, params.targetId)
          .map((row) => mapDocumentRow(demoDocToRow(row)));
        const ids = new Set(linked.map((doc) => doc.id));
        return docs.filter((doc) => ids.has(doc.id));
      }
      return docs;
    }
    throw error;
  }
}

export async function getKnowledgeDocumentById(ctx: KnowledgeContext, id: string): Promise<SaasKnowledgeDocument | null> {
  if (ctx.mode === "demo") {
    const record = getDemoKnowledgeDocumentById(demoTenantId(ctx), id);
    return record ? mapDocumentRow(demoDocToRow(record)) : null;
  }
  try {
    const rows = await queryAll<DocumentRow>(
      `SELECT id, tenant_id, saas_id, space_id, title, type, source, status, audience, importance, summary, content, tags,
              created_by_employee_id, created_at, updated_at, metadata
       FROM saas_knowledge_documents
       WHERE tenant_id = ? AND id = ?
       LIMIT 1`,
      ctx.tenantId,
      id,
    );
    return rows[0] ? mapDocumentRow(rows[0]) : null;
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const record = getDemoKnowledgeDocumentById(demoTenantId(ctx), id);
      return record ? mapDocumentRow(demoDocToRow(record)) : null;
    }
    throw error;
  }
}

export async function createKnowledgeDocument(ctx: KnowledgeContext, input: CreateKnowledgeDocumentInput): Promise<SaasKnowledgeDocument> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = generateUuid();
  const audience = input.audience ?? "BOTH";
  const importance = input.importance ?? "STANDARD";

  if (ctx.mode === "demo") {
    const record = createDemoKnowledgeDocument(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      space_id: input.spaceId ?? null,
      title: input.title,
      type: input.type,
      source: input.source,
      status: input.status,
      audience,
      importance,
      summary: input.summary ?? null,
      content: input.content,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      created_by_employee_id: input.createdByEmployeeId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    });
    return mapDocumentRow(demoDocToRow(record));
  }

  await run(
    `INSERT INTO saas_knowledge_documents
     (id, tenant_id, saas_id, space_id, title, type, source, status, audience, importance, summary, content, tags, created_by_employee_id, created_at, updated_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    input.spaceId ?? null,
    input.title,
    input.type,
    input.source,
    input.status,
    audience,
    importance,
    input.summary ?? null,
    input.content,
    input.tags ? JSON.stringify(input.tags) : null,
    input.createdByEmployeeId ?? null,
    now,
    now,
    input.metadata ? JSON.stringify(input.metadata) : null,
  );

  return {
    id,
    tenantId: ctx.tenantId,
    saasId,
    spaceId: input.spaceId ?? null,
    title: input.title,
    type: input.type,
    source: input.source,
    status: input.status,
    audience,
    importance,
    summary: input.summary ?? null,
    content: input.content,
    tags: input.tags ?? null,
    createdByEmployeeId: input.createdByEmployeeId ?? null,
    createdAt: now,
    updatedAt: now,
    metadata: input.metadata ?? null,
  };
}

export async function updateKnowledgeDocument(
  ctx: KnowledgeContext,
  id: string,
  input: UpdateKnowledgeDocumentInput,
): Promise<SaasKnowledgeDocument | null> {
  const current = await getKnowledgeDocumentById(ctx, id);
  if (!current) return null;
  const now = new Date().toISOString();
  const next: SaasKnowledgeDocument = {
    ...current,
    spaceId: typeof input.spaceId === "undefined" ? current.spaceId ?? null : input.spaceId,
    title: input.title ?? current.title,
    type: input.type ?? current.type,
    status: input.status ?? current.status,
    audience: input.audience ?? current.audience,
    importance: input.importance ?? current.importance,
    summary: typeof input.summary === "undefined" ? current.summary ?? null : input.summary,
    content: input.content ?? current.content,
    tags: typeof input.tags === "undefined" ? current.tags ?? null : input.tags,
    metadata: typeof input.metadata === "undefined" ? current.metadata ?? null : input.metadata,
    updatedAt: now,
  };

  if (ctx.mode === "demo") {
    const record = updateDemoKnowledgeDocument(demoTenantId(ctx), current.id, {
      space_id: next.spaceId ?? null,
      title: next.title,
      type: next.type,
      status: next.status,
      audience: next.audience,
      importance: next.importance,
      summary: next.summary ?? null,
      content: next.content,
      tags: next.tags ? JSON.stringify(next.tags) : null,
      metadata: next.metadata ? JSON.stringify(next.metadata) : null,
    });
    return record ? mapDocumentRow(demoDocToRow(record)) : null;
  }

  await run(
    `UPDATE saas_knowledge_documents
     SET space_id = ?, title = ?, type = ?, status = ?, audience = ?, importance = ?, summary = ?, content = ?, tags = ?, metadata = ?, updated_at = ?
     WHERE tenant_id = ? AND id = ?`,
    next.spaceId ?? null,
    next.title,
    next.type,
    next.status,
    next.audience,
    next.importance,
    next.summary ?? null,
    next.content,
    next.tags ? JSON.stringify(next.tags) : null,
    next.metadata ? JSON.stringify(next.metadata) : null,
    now,
    ctx.tenantId,
    id,
  );

  return next;
}

export async function listKnowledgeLinksForTarget(
  ctx: KnowledgeContext,
  targetType: SaasKnowledgeLinkTargetType,
  targetId: string,
): Promise<SaasKnowledgeLink[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const links = listDemoKnowledgeLinksForTarget(demoTenantId(ctx), saasId, targetType, targetId);
    return links.map((link) => mapLinkRow(demoLinkToRow(link)));
  }
  try {
    const rows = await queryAll<LinkRow>(
      `SELECT id, tenant_id, saas_id, document_id, target_type, target_id, created_at
       FROM saas_knowledge_links
       WHERE tenant_id = ? AND saas_id = ? AND target_type = ? AND target_id = ?
       ORDER BY datetime(created_at) DESC`,
      ctx.tenantId,
      saasId,
      targetType,
      targetId,
    );
    return rows.map(mapLinkRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const links = listDemoKnowledgeLinksForTarget(demoTenantId(ctx), saasId, targetType, targetId);
      return links.map((link) => mapLinkRow(demoLinkToRow(link)));
    }
    throw error;
  }
}

export async function listKnowledgeLinksForDocument(ctx: KnowledgeContext, documentId: string): Promise<SaasKnowledgeLink[]> {
  const saasId = requireSaasId(ctx);
  if (ctx.mode === "demo") {
    const links = listDemoKnowledgeLinksForDocument(demoTenantId(ctx), saasId, documentId);
    return links.map((link) => mapLinkRow(demoLinkToRow(link)));
  }
  try {
    const rows = await queryAll<LinkRow>(
      `SELECT id, tenant_id, saas_id, document_id, target_type, target_id, created_at
       FROM saas_knowledge_links
       WHERE tenant_id = ? AND saas_id = ? AND document_id = ?
       ORDER BY datetime(created_at) DESC`,
      ctx.tenantId,
      saasId,
      documentId,
    );
    return rows.map(mapLinkRow);
  } catch (error) {
    if (shouldFallbackToDemo(error, ctx)) {
      const links = listDemoKnowledgeLinksForDocument(demoTenantId(ctx), saasId, documentId);
      return links.map((link) => mapLinkRow(demoLinkToRow(link)));
    }
    throw error;
  }
}

export async function listKnowledgeDocumentsForTarget(
  ctx: KnowledgeContext,
  targetType: SaasKnowledgeLinkTargetType,
  targetId: string,
): Promise<SaasKnowledgeDocument[]> {
  const docs = await listKnowledgeDocuments(ctx, { targetType, targetId });
  return docs;
}

export async function createKnowledgeLink(ctx: KnowledgeContext, input: CreateKnowledgeLinkInput): Promise<SaasKnowledgeLink> {
  const saasId = input.saasId?.trim() ?? requireSaasId(ctx);
  const now = new Date().toISOString();
  const id = generateUuid();
  if (ctx.mode === "demo") {
    const record = createDemoKnowledgeLink(demoTenantId(ctx), {
      id,
      saas_id: saasId,
      document_id: input.documentId,
      target_type: input.targetType,
      target_id: input.targetId,
    });
    return mapLinkRow(demoLinkToRow(record));
  }
  await run(
    `INSERT INTO saas_knowledge_links (id, tenant_id, saas_id, document_id, target_type, target_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    ctx.tenantId,
    saasId,
    input.documentId,
    input.targetType,
    input.targetId,
    now,
  );
  return {
    id,
    tenantId: ctx.tenantId,
    saasId,
    documentId: input.documentId,
    targetType: input.targetType,
    targetId: input.targetId,
    createdAt: now,
  };
}

export async function deleteKnowledgeLink(ctx: KnowledgeContext, linkId: string): Promise<boolean> {
  if (ctx.mode === "demo") {
    return deleteDemoKnowledgeLink(demoTenantId(ctx), linkId);
  }
  const saasId = requireSaasId(ctx);
  await run(
    `DELETE FROM saas_knowledge_links
     WHERE tenant_id = ? AND saas_id = ? AND id = ?`,
    ctx.tenantId,
    saasId,
    linkId,
  );
  return true;
}
