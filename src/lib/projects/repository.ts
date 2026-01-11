import { queryAll as queryAllDb, queryOne as queryOneDb, run as runDb } from "@/lib/db";

export type ProjectRecord = {
  id: string;
  tenant_id: string;
  company_id: string | null;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProjectDomainRecord = {
  id: string;
  tenant_id: string;
  project_id: string;
  domain: string;
  status: string;
  created_at: string;
};

export type ProjectEntitlementsRecord = {
  tenant_id: string;
  project_id: string;
  packs_json: string;
  features_json: string;
  updated_at: string;
};

export type ProjectDetail = {
  project: ProjectRecord;
  domains: ProjectDomainRecord[];
  entitlements: {
    packs: string[];
    features: string[];
    updated_at: string | null;
  };
};

type CreateProjectInput = {
  tenantId: string;
  companyId?: string | null;
  name: string;
  slug?: string | null;
  domain?: string | null;
};

type ListProjectsFilters = {
  tenantId: string;
  companyId?: string | null;
};

type GetProjectByIdInput = {
  tenantId: string;
  projectId: string;
};

type QueryAllFn = <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
type QueryOneFn = <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
type RunFn = (sql: string, ...params: unknown[]) => Promise<boolean>;

type DbAdapter = {
  queryAll: QueryAllFn;
  queryOne: QueryOneFn;
  run: RunFn;
};

const defaultDb: DbAdapter = {
  queryAll: queryAllDb,
  queryOne: queryOneDb,
  run: runDb,
};

function resolveDbAdapter(adapter?: Partial<DbAdapter>): DbAdapter {
  if (!adapter) return defaultDb;
  return {
    queryAll: adapter.queryAll ?? defaultDb.queryAll,
    queryOne: adapter.queryOne ?? defaultDb.queryOne,
    run: adapter.run ?? defaultDb.run,
  };
}

export async function createProject(input: CreateProjectInput, adapter?: Partial<DbAdapter>): Promise<ProjectDetail> {
  const db = resolveDbAdapter(adapter);
  const tenantId = input.tenantId.trim();
  if (!tenantId) throw new Error("tenantId es obligatorio");

  const name = input.name?.trim();
  if (!name) throw new Error("name es obligatorio");

  const companyId = input.companyId?.trim() || null;
  const id = generateId("proj");
  const now = new Date().toISOString();
  const baseSlug = sanitizeSlug(input.slug) || toSlug(name) || `project-${id.slice(-6)}`;
  const slugBase = baseSlug.length > 0 ? baseSlug : "project";
  const slug = await ensureUniqueSlug(tenantId, slugBase, db);

  const ok = await db.run(
    `INSERT INTO projects (id, tenant_id, company_id, name, slug, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
    id,
    tenantId,
    companyId,
    name,
    slug,
    now,
    now,
  );

  if (!ok) throw new Error("No se pudo crear el proyecto");

  if (input.domain?.trim()) {
    await insertDomain({
      tenantId,
      projectId: id,
      domain: input.domain.trim(),
    }, db);
  }

  await ensureEntitlementsRow({ tenantId, projectId: id, timestamp: now }, db);

  const detail = await getProjectById({ tenantId, projectId: id }, db);
  if (!detail) throw new Error("Proyecto creado pero no encontrado");
  return detail;
}

export async function listProjects(filters: ListProjectsFilters, adapter?: Partial<DbAdapter>): Promise<ProjectRecord[]> {
  const db = resolveDbAdapter(adapter);
  const tenantId = filters.tenantId.trim();
  if (!tenantId) throw new Error("tenantId es obligatorio");

  const clauses = ["tenant_id = ?"];
  const params: (string | null)[] = [tenantId];

  if (filters.companyId) {
    clauses.push("company_id = ?");
    params.push(filters.companyId.trim());
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  return db.queryAll<ProjectRecord>(
    `SELECT id, tenant_id, company_id, name, slug, status, created_at, updated_at
     FROM projects
     ${whereClause}
     ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC`,
    ...params,
  );
}

export async function getProjectById(input: GetProjectByIdInput, adapter?: Partial<DbAdapter>): Promise<ProjectDetail | null> {
  const db = resolveDbAdapter(adapter);
  const tenantId = input.tenantId.trim();
  const projectId = input.projectId.trim();
  if (!tenantId) throw new Error("tenantId es obligatorio");
  if (!projectId) throw new Error("projectId es obligatorio");

  const project = await db.queryOne<ProjectRecord>(
    `SELECT id, tenant_id, company_id, name, slug, status, created_at, updated_at
     FROM projects
     WHERE tenant_id = ? AND id = ?
     LIMIT 1`,
    tenantId,
    projectId,
  );

  if (!project) return null;

  const domains = await db.queryAll<ProjectDomainRecord>(
    `SELECT id, tenant_id, project_id, domain, status, created_at
     FROM project_domains
     WHERE tenant_id = ? AND project_id = ?
     ORDER BY datetime(created_at) DESC, domain ASC`,
    tenantId,
    projectId,
  );

  const entitlementsRow = await db.queryOne<ProjectEntitlementsRecord>(
    `SELECT tenant_id, project_id, packs_json, features_json, updated_at
     FROM project_entitlements
     WHERE tenant_id = ? AND project_id = ?
     LIMIT 1`,
    tenantId,
    projectId,
  );

  const entitlements = deserializeEntitlements(entitlementsRow);

  return {
    project,
    domains,
    entitlements,
  };
}

async function ensureEntitlementsRow({
  tenantId,
  projectId,
  timestamp,
}: {
  tenantId: string;
  projectId: string;
  timestamp: string;
}, db: DbAdapter) {
  await db.run(
    `INSERT OR IGNORE INTO project_entitlements (tenant_id, project_id, packs_json, features_json, updated_at)
     VALUES (?, ?, '[]', '[]', ?)` ,
    tenantId,
    projectId,
    timestamp,
  );
}

async function insertDomain({
  tenantId,
  projectId,
  domain,
}: {
  tenantId: string;
  projectId: string;
  domain: string;
}, db: DbAdapter) {
  const id = generateId("projdom");
  const now = new Date().toISOString();
  const normalizedDomain = domain.trim().toLowerCase();
  await db.run(
    `INSERT OR IGNORE INTO project_domains (id, tenant_id, project_id, domain, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)` ,
    id,
    tenantId,
    projectId,
    normalizedDomain,
    now,
  );
}

function deserializeEntitlements(row: ProjectEntitlementsRecord | null): {
  packs: string[];
  features: string[];
  updated_at: string | null;
} {
  if (!row) {
    return { packs: [], features: [], updated_at: null };
  }

  return {
    packs: safeParseStringArray(row.packs_json),
    features: safeParseStringArray(row.features_json),
    updated_at: row.updated_at ?? null,
  };
}

function safeParseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => typeof item === "string");
    }
    return [];
  } catch (error) {
    console.warn("PROJECT_ENTITLEMENTS_PARSE_ERROR", error);
    return [];
  }
}

async function ensureUniqueSlug(tenantId: string, desiredSlug: string, db: DbAdapter): Promise<string> {
  let slug = desiredSlug;
  let counter = 1;
  while (await slugExists(tenantId, slug, db)) {
    slug = `${desiredSlug}-${counter++}`;
  }
  return slug;
}

async function slugExists(tenantId: string, slug: string, db: DbAdapter): Promise<boolean> {
  const row = await db.queryOne<{ count: number }>(
    `SELECT COUNT(1) as count FROM projects WHERE tenant_id = ? AND slug = ? LIMIT 1`,
    tenantId,
    slug,
  );
  return Boolean(row?.count);
}

function sanitizeSlug(value?: string | null): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      ?.replace(/--+/g, "-")
      ?.replace(/^-|-$/g, "") ?? ""
  );
}

function toSlug(value: string): string {
  return sanitizeSlug(value) ?? "";
}

function generateId(prefix: string): string {
  const base = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}_${base}`;
}
