import "./register-paths";
import { strict as assert } from "node:assert";
import type { D1Database } from "@cloudflare/workers-types";
import { NextResponse } from "next/server";
import { runtime } from "@/app/api/projects/[id]/route";
import * as projectsShowRoute from "@/app/api/projects/[id]/route";
import * as projectsIndexRoute from "@/app/api/projects/route";
import {
  createProject,
  getProjectById,
  listProjects,
  type ProjectRecord,
  type ProjectDomainRecord,
  type ProjectEntitlementsRecord,
} from "@/lib/projects/repository";
import * as sessionModule from "@/lib/auth/session";
import * as cfModule from "@/lib/cf";

type DbAdapter = {
  run: (sql: string, ...params: unknown[]) => Promise<boolean>;
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  queryAll: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
};

type SessionModuleMutable = {
  requireTenantAccess: typeof sessionModule.requireTenantAccess;
  UnauthorizedError: typeof sessionModule.UnauthorizedError;
};

type CfModuleMutable = {
  env: typeof cfModule.env;
};

const sessionMutable = sessionModule as unknown as SessionModuleMutable;
const cfMutable = cfModule as unknown as CfModuleMutable;

const ORIGINAL_REQUIRE_TENANT_ACCESS = sessionMutable.requireTenantAccess;
const ORIGINAL_ENV = cfMutable.env;

class ProjectsDbMock {
  projects = new Map<string, ProjectRecord>();
  slugIndex = new Map<string, ProjectRecord>();
  domains: ProjectDomainRecord[] = [];
  entitlements = new Map<string, ProjectEntitlementsRecord>();
  lastQuery: { sql: string; params: unknown[] } | null = null;

  projectKey(tenantId: string, projectId: string) {
    return `${tenantId}::${projectId}`;
  }

  slugKey(tenantId: string, slug: string) {
    return `${tenantId}::slug::${slug}`;
  }

  normalize(sql: string) {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
  }

  async run(sql: string, ...params: unknown[]) {
    this.lastQuery = { sql, params };
    const normalized = this.normalize(sql);
    if (normalized.includes("insert into projects")) {
      const [id, tenantId, companyId, name, slug, createdAt, updatedAt] = params as [
        string,
        string,
        string | null,
        string,
        string,
        string,
        string,
      ];
      const record: ProjectRecord = {
        id,
        tenant_id: tenantId,
        company_id: companyId ?? null,
        name,
        slug,
        status: "active",
        created_at: createdAt,
        updated_at: updatedAt,
      };
      this.projects.set(this.projectKey(tenantId, id), record);
      this.slugIndex.set(this.slugKey(tenantId, slug), record);
      return true;
    }
    if (normalized.includes("insert or ignore into project_domains")) {
      const [id, tenantId, projectId, domain, createdAt] = params as [string, string, string, string, string];
      this.domains.push({ id, tenant_id: tenantId, project_id: projectId, domain, status: "pending", created_at: createdAt });
      return true;
    }
    if (normalized.includes("insert or ignore into project_entitlements")) {
      const [tenantId, projectId, updatedAt] = params as [string, string, string];
      const key = this.projectKey(tenantId, projectId);
      this.entitlements.set(key, {
        tenant_id: tenantId,
        project_id: projectId,
        packs_json: "[]",
        features_json: "[]",
        updated_at: updatedAt,
      });
      return true;
    }
    throw new Error(`Unsupported SQL: ${sql}`);
  }

  async queryOne<T>(sql: string, ...params: unknown[]) {
    this.lastQuery = { sql, params };
    const normalized = this.normalize(sql);
    if (normalized.includes("count(1) as count")) {
      const [tenantId, slug] = params as [string, string];
      const exists = this.slugIndex.has(this.slugKey(tenantId, slug));
      return ({ count: exists ? 1 : 0 } as unknown) as T;
    }
    if (normalized.includes("from projects")) {
      const [tenantId, projectId] = params as [string, string];
      return (this.projects.get(this.projectKey(tenantId, projectId)) as unknown) as T | null;
    }
    if (normalized.includes("from project_entitlements")) {
      const [tenantId, projectId] = params as [string, string];
      return (this.entitlements.get(this.projectKey(tenantId, projectId)) as unknown) as T | null;
    }
    return null;
  }

  async queryAll<T>(sql: string, ...params: unknown[]) {
    this.lastQuery = { sql, params };
    const normalized = this.normalize(sql);
    if (normalized.includes("from projects")) {
      const [tenantId, second] = params as [string, string?];
      const results = Array.from(this.projects.values()).filter((project) => project.tenant_id === tenantId);

      if (normalized.includes("and id = ?")) {
        if (typeof second === "string") {
          return results.filter((project) => project.id === second) as unknown as T[];
        }
        return [];
      }

      let filtered = results;
      if (normalized.includes("and company_id = ?")) {
        const companyId = typeof second === "string" ? second : null;
        filtered = companyId ? results.filter((project) => project.company_id === companyId) : results;
      }

      return filtered.sort((a, b) => b.updated_at.localeCompare(a.updated_at)) as unknown as T[];
    }
    if (normalized.includes("from project_domains")) {
      const [tenantId, projectId] = params as [string, string];
      return this.domains.filter((row) => row.tenant_id === tenantId && row.project_id === projectId) as unknown as T[];
    }
    if (normalized.includes("from project_entitlements")) {
      const [tenantId, projectId] = params as [string, string];
      const key = this.projectKey(tenantId, projectId);
      const record = this.entitlements.get(key);
      return record ? ([record] as unknown as T[]) : ([] as unknown as T[]);
    }
    return [];
  }

  seedProject(record: ProjectRecord) {
    this.projects.set(this.projectKey(record.tenant_id, record.id), record);
    this.slugIndex.set(this.slugKey(record.tenant_id, record.slug), record);
  }

  seedDomain(record: ProjectDomainRecord) {
    this.domains.push(record);
  }

  seedEntitlements(record: ProjectEntitlementsRecord) {
    this.entitlements.set(this.projectKey(record.tenant_id, record.project_id), record);
  }
}

async function testProjectsDetailRouteNotFound() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_1");

  try {
    const response = await projectsShowRoute.GET(
      createRequest("https://example.test/api/projects/missing"),
      { params: Promise.resolve({ id: "missing" }) },
    );
    assert.equal(response.status, 404, "Missing project should return 404");
    const payload = (await response.json()) as { ok: boolean; error: string };
    assert.equal(payload.ok, false, "Missing project response should be failure");
    assert.equal(payload.error, "Proyecto no encontrado", "Error message should indicate missing project");
  } finally {
    resetModuleStubs();
  }
}

async function testProjectsDetailRouteTenantMismatch() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_1", { error: new sessionModule.UnauthorizedError("TENANT_MISMATCH", 403) });

  try {
    const response = await projectsShowRoute.GET(
      createRequest("https://example.test/api/projects/proj_forbidden"),
      { params: Promise.resolve({ id: "proj_forbidden" }) },
    );
    assert.equal(response.status, 403, "Tenant mismatch should return 403");
    const payload = (await response.json()) as { ok: boolean; error: string };
    assert.equal(payload.ok, false, "Tenant mismatch should mark failure");
    assert.equal(payload.error, "TENANT_MISMATCH", "Error message should surface tenant mismatch");
  } finally {
    resetModuleStubs();
  }
}

async function testProjectsListRouteFiltersByCompany() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_a",
    tenant_id: "tenant_1",
    company_id: "comp_a",
    name: "Project A",
    slug: "project-a",
    status: "active",
    created_at: "2025-04-01T00:00:00Z",
    updated_at: "2025-04-02T00:00:00Z",
  });
  mock.seedProject({
    id: "proj_b",
    tenant_id: "tenant_1",
    company_id: "comp_b",
    name: "Project B",
    slug: "project-b",
    status: "active",
    created_at: "2025-04-03T00:00:00Z",
    updated_at: "2025-04-04T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_1");

  try {
    const listAll = await projectsIndexRoute.GET(createRequest("https://example.test/api/projects"));
    assert.equal(listAll.status, 200, "List route should succeed");
    const allPayload = (await listAll.json()) as { ok: boolean; items: ProjectRecord[] };
    assert.equal(allPayload.ok, true, "List route should indicate success");
    assert.equal(allPayload.items.length, 2, "Both projects should be returned");

    const listFiltered = await projectsIndexRoute.GET(
      createRequest("https://example.test/api/projects?company_id=comp_b"),
    );
    assert.equal(listFiltered.status, 200, "Filtered list should succeed");
    const filteredPayload = (await listFiltered.json()) as { ok: boolean; items: ProjectRecord[] };
    assert.equal(filteredPayload.ok, true, "Filtered response should indicate success");
    assert.equal(filteredPayload.items.length, 1, "Filter should narrow results to one project");
    assert.equal(filteredPayload.items[0]?.id, "proj_b", "Filtered item should match company");
  } finally {
    resetModuleStubs();
  }
}

async function testProjectsCreateRouteValidationErrors() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_1");

  try {
    const missingNameResponse = await projectsIndexRoute.POST(
      createRequest("https://example.test/api/projects", {
        method: "POST",
        body: JSON.stringify({ company_id: "comp_a" }),
      }),
    );
    assert.equal(missingNameResponse.status, 400, "Missing name should return 400");
    const missingNamePayload = (await missingNameResponse.json()) as { ok: boolean; error: string };
    assert.equal(missingNamePayload.ok, false, "Missing name should be failure");
    assert.equal(missingNamePayload.error, "name es obligatorio", "Error should mention missing name");

    const missingCompanyResponse = await projectsIndexRoute.POST(
      createRequest("https://example.test/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Sin Compañía" }),
      }),
    );
    assert.equal(missingCompanyResponse.status, 400, "Missing company should return 400");
    const missingCompanyPayload = (await missingCompanyResponse.json()) as { ok: boolean; error: string };
    assert.equal(missingCompanyPayload.ok, false, "Missing company should be failure");
    assert.equal(missingCompanyPayload.error, "company_id es obligatorio", "Error should mention missing company");
  } finally {
    resetModuleStubs();
  }
}

function installDbMocks(mock: ProjectsDbMock) {
  type FakeStatement = {
    bind: (...params: unknown[]) => FakeStatement;
    all: <T>() => Promise<{ results: T[] }>;
    first: <T>() => Promise<T | null>;
    raw: <T>() => Promise<unknown[]>;
    run: () => Promise<{ success: boolean }>;
  };

  const createStatement = (sql: string, boundParams: unknown[] = []): FakeStatement => {
    return {
      bind: (...params: unknown[]) => createStatement(sql, params),
      all: async <T>() => {
        const results = await mock.queryAll<T>(sql, ...boundParams);
        return { results };
      },
      first: async <T>() => {
        const rows = await mock.queryAll<T>(sql, ...boundParams);
        return rows[0] ?? null;
      },
      raw: async <T>() => {
        const rows = await mock.queryAll<T>(sql, ...boundParams);
        return rows as unknown[];
      },
      run: async () => {
        const success = await mock.run(sql, ...boundParams);
        return { success };
      },
    };
  };

  const fakeDb = {
    prepare(sql: string) {
      return createStatement(sql);
    },
  } as unknown as D1Database;

  cfMutable.env = () => ({ DRACO_DB: fakeDb, SESSION_SECRET: "dummy" });
}

function installRequireTenantAccessMock(tenantId: string, options?: { error?: Error }) {
  sessionMutable.requireTenantAccess = async () => {
    if (options?.error) throw options.error;
    return {
      tenantId,
      session: { email: "demo@drako.systems", tenantId, role: "admin", issuedAt: Date.now() },
    };
  };
}

function resetModuleStubs() {
  sessionMutable.requireTenantAccess = ORIGINAL_REQUIRE_TENANT_ACCESS;
  cfMutable.env = ORIGINAL_ENV;
}

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    method: init?.method ?? "GET",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
}

async function testProjectsRouteRuntimeIsEdge() {
  assert.equal(runtime, "edge", "API routes must export edge runtime");
}

async function testProjectsDetailRouteSuccess() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_ok",
    tenant_id: "tenant_1",
    company_id: "comp_a",
    name: "Project OK",
    slug: "project-ok",
    status: "active",
    created_at: "2025-03-01T00:00:00Z",
    updated_at: "2025-03-02T00:00:00Z",
  });
  mock.seedDomain({
    id: "dom_ok",
    tenant_id: "tenant_1",
    project_id: "proj_ok",
    domain: "ok.example",
    status: "verified",
    created_at: "2025-03-03T00:00:00Z",
  });
  mock.seedEntitlements({
    tenant_id: "tenant_1",
    project_id: "proj_ok",
    packs_json: JSON.stringify(["growth"]),
    features_json: JSON.stringify(["automation"]),
    updated_at: "2025-03-04T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_1");

  try {
    const response = await projectsShowRoute.GET(
      createRequest("https://example.test/api/projects/proj_ok"),
      { params: Promise.resolve({ id: "proj_ok" }) },
    );
    assert.equal(response.status, 200, "Detail route should succeed");
    const payload = (await response.json()) as {
      ok: boolean;
      item: { project: ProjectRecord; domains: ProjectDomainRecord[]; entitlements: { packs: string[]; features: string[] } };
    };
    assert.equal(payload.ok, true, "Response should indicate success");
    assert.equal(payload.item.project.name, "Project OK", "Project name should roundtrip");
    assert.equal(payload.item.domains[0]?.domain, "ok.example", "Domain list should include seeded value");
    assert.deepEqual(payload.item.entitlements.packs, ["growth"], "Entitlements packs should parse");
  } finally {
    resetModuleStubs();
  }
}

async function testCreateProjectGeneratesUniqueSlug() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "existing",
    tenant_id: "tenant_1",
    company_id: "comp_1",
    name: "Alpha",
    slug: "alpha",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });

  const adapter: DbAdapter = {
    run: mock.run.bind(mock),
    queryOne: mock.queryOne.bind(mock),
    queryAll: mock.queryAll.bind(mock),
  };

  const detail = await createProject(
    {
      tenantId: "tenant_1",
      companyId: "comp_1",
      name: "Alpha",
      domain: "Example.COM",
    },
    adapter,
  );

  assert.equal(detail.project.slug, "alpha-1", "Slug should be suffixed when duplicate exists");
  assert.equal(detail.domains[0]?.domain, "example.com", "Domain should be normalized to lowercase");
  const key = mock.projectKey("tenant_1", detail.project.id);
  assert.ok(mock.entitlements.has(key), "Entitlements row should be created");
  assert.deepEqual(detail.entitlements.packs, [], "Entitlements packs should default to empty array");
  assert.deepEqual(detail.entitlements.features, [], "Entitlements features should default to empty array");
  assert.ok(detail.entitlements.updated_at, "Entitlements updated_at should be populated");
}

async function testListProjectsFiltersByCompany() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_a",
    tenant_id: "tenant_1",
    company_id: "comp_a",
    name: "Project A",
    slug: "project-a",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  });
  mock.seedProject({
    id: "proj_b",
    tenant_id: "tenant_1",
    company_id: "comp_b",
    name: "Project B",
    slug: "project-b",
    status: "active",
    created_at: "2025-01-03T00:00:00Z",
    updated_at: "2025-01-04T00:00:00Z",
  });

  const adapter: DbAdapter = { run: mock.run.bind(mock), queryOne: mock.queryOne.bind(mock), queryAll: mock.queryAll.bind(mock) };

  const filtered = await listProjects({ tenantId: "tenant_1", companyId: "comp_b" }, adapter);
  assert.equal(filtered.length, 1, "Filter should return a single project");
  assert.equal(filtered[0]?.id, "proj_b", "Returned project should match company filter");

  const all = await listProjects({ tenantId: "tenant_1" }, adapter);
  assert.equal(all.length, 2, "Without company filter both projects should return");
}

async function testGetProjectDetailIncludesDomainsAndEntitlements() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_x",
    tenant_id: "tenant_1",
    company_id: "comp_x",
    name: "Project X",
    slug: "project-x",
    status: "active",
    created_at: "2025-02-01T00:00:00Z",
    updated_at: "2025-02-02T00:00:00Z",
  });
  mock.seedDomain({
    id: "dom_x",
    tenant_id: "tenant_1",
    project_id: "proj_x",
    domain: "x.example",
    status: "verified",
    created_at: "2025-02-03T00:00:00Z",
  });
  mock.seedEntitlements({
    tenant_id: "tenant_1",
    project_id: "proj_x",
    packs_json: JSON.stringify(["starter"]),
    features_json: JSON.stringify(["automation"]),
    updated_at: "2025-02-04T00:00:00Z",
  });

  const adapter: DbAdapter = { run: mock.run.bind(mock), queryOne: mock.queryOne.bind(mock), queryAll: mock.queryAll.bind(mock) };

  const detail = await getProjectById({ tenantId: "tenant_1", projectId: "proj_x" }, adapter);
  assert.ok(detail, "Detail should be resolved");
  assert.equal(detail?.project.name, "Project X", "Project name should match");
  assert.equal(detail?.domains.length, 1, "Domains list should be returned");
  assert.deepEqual(detail?.entitlements.packs, ["starter"], "Packs should be parsed from JSON");
  assert.deepEqual(detail?.entitlements.features, ["automation"], "Features should be parsed from JSON");
}

async function run() {
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "projects route exports edge runtime", fn: testProjectsRouteRuntimeIsEdge },
    { name: "projects detail route succeeds", fn: testProjectsDetailRouteSuccess },
    { name: "projects detail route returns 404", fn: testProjectsDetailRouteNotFound },
    { name: "projects detail route enforces tenant", fn: testProjectsDetailRouteTenantMismatch },
    { name: "projects list route filters by company", fn: testProjectsListRouteFiltersByCompany },
    { name: "projects create route validates payload", fn: testProjectsCreateRouteValidationErrors },
    { name: "createProject generates unique slug and entitlements", fn: testCreateProjectGeneratesUniqueSlug },
    { name: "listProjects filters by company", fn: testListProjectsFiltersByCompany },
    { name: "getProjectById returns domains and entitlements", fn: testGetProjectDetailIncludesDomainsAndEntitlements },
  ];

  let failures = 0;
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`✅ ${test.name}`);
    } catch (error) {
      failures += 1;
      console.error(`❌ ${test.name}`);
      console.error(error instanceof Error ? error.stack : error);
    }
  }

  if (failures > 0) {
    console.error(`❌ Completed with ${failures} failing test(s).`);
    process.exit(1);
  }

  console.log("✅ All projects API tests passed");
}

run().catch((error) => {
  console.error("❌ Unexpected projects API test failure");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
