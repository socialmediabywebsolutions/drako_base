import "./register-paths";
import { strict as assert } from "node:assert";
import { runtime } from "@/app/api/projects/[id]/route";
import * as projectsShowRoute from "@/app/api/projects/[id]/route";
import * as projectsIndexRoute from "@/app/api/projects/route";
import {
  createProject,
  getProjectById,
  listProjects,
  type ProjectDetail,
  type ProjectDomainRecord,
  type ProjectRecord,
} from "@/lib/projects/repository";
import { UnauthorizedError } from "@/lib/auth/session";
import {
  ProjectsDbMock,
  installDbMocks,
  installRequireTenantAccessMock,
  resetModuleStubs,
  createRequest,
} from "./test-utils/projects-test-helpers";

type DbAdapter = {
  run: (sql: string, ...params: unknown[]) => Promise<boolean>;
  queryOne: <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
  queryAll: <T>(sql: string, ...params: unknown[]) => Promise<T[]>;
};

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
  installRequireTenantAccessMock("tenant_1", { error: new UnauthorizedError("TENANT_MISMATCH", 403) });

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

  } finally {
    resetModuleStubs();
  }
}

async function testProjectsCreateRouteAllowsMissingCompany() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_1");

  try {
    const response = await projectsIndexRoute.POST(
      createRequest("https://example.test/api/projects", {
        method: "POST",
        body: JSON.stringify({ name: "Proyecto Libre" }),
      }),
    );
    assert.equal(response.status, 200, "Route should allow missing company");
    const payload = (await response.json()) as {
      ok: boolean;
      item: { project: ProjectRecord };
    };
    assert.equal(payload.ok, true, "Response should indicate success");
    assert.ok(payload.item.project.id, "Created project should include id");
    assert.equal(payload.item.project.company_id, null, "Company should default to null");
    assert.ok(payload.item.project.slug.length > 0, "Slug should auto-generate");
  } finally {
    resetModuleStubs();
  }
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
    verification_token: null,
    last_error: null,
    created_at: "2025-03-03T00:00:00Z",
    updated_at: "2025-03-05T00:00:00Z",
  });
  mock.seedEntitlements({
    tenant_id: "tenant_1",
    project_id: "proj_ok",
    packs_json: JSON.stringify(["growth"]),
    features_json: JSON.stringify(["automation"]),
    limits_json: JSON.stringify({ seats: 5 }),
    metadata_json: JSON.stringify({ tier: "growth" }),
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
    const payload = (await response.json()) as { ok: boolean; item: ProjectDetail };
    assert.equal(payload.ok, true, "Response should indicate success");
    assert.equal(payload.item.project.name, "Project OK", "Project name should roundtrip");
    assert.equal(payload.item.domains[0]?.domain, "ok.example", "Domain list should include seeded value");
    assert.deepEqual(payload.item.entitlements.enabledPacks, ["growth"], "Entitlements packs should parse");
    assert.deepEqual(payload.item.entitlements.enabledFeatures, ["automation"], "Entitlements features should parse");
    assert.deepEqual(payload.item.entitlements.limits, { seats: 5 }, "Entitlements limits should parse");
    assert.deepEqual(payload.item.entitlements.metadata, { tier: "growth" }, "Entitlements metadata should parse");
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
  assert.deepEqual(detail.entitlements.enabledPacks, [], "Entitlements packs should default to empty array");
  assert.deepEqual(detail.entitlements.enabledFeatures, [], "Entitlements features should default to empty array");
  assert.ok(detail.entitlements.updatedAt, "Entitlements updatedAt should be populated");
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
    verification_token: null,
    last_error: null,
    created_at: "2025-02-03T00:00:00Z",
    updated_at: "2025-02-05T00:00:00Z",
  });
  mock.seedEntitlements({
    tenant_id: "tenant_1",
    project_id: "proj_x",
    packs_json: JSON.stringify(["starter"]),
    features_json: JSON.stringify(["automation"]),
    limits_json: JSON.stringify({ seats: 3 }),
    metadata_json: JSON.stringify({ tier: "pro" }),
    updated_at: "2025-02-04T00:00:00Z",
  });

  const adapter: DbAdapter = { run: mock.run.bind(mock), queryOne: mock.queryOne.bind(mock), queryAll: mock.queryAll.bind(mock) };

  const detail = await getProjectById({ tenantId: "tenant_1", projectId: "proj_x" }, adapter);
  assert.ok(detail, "Detail should be resolved");
  assert.equal(detail?.project.name, "Project X", "Project name should match");
  assert.equal(detail?.domains.length, 1, "Domains list should be returned");
  assert.deepEqual(detail?.entitlements.enabledPacks, ["starter"], "Packs should be parsed from JSON");
  assert.deepEqual(detail?.entitlements.enabledFeatures, ["automation"], "Features should be parsed from JSON");
  assert.deepEqual(detail?.entitlements.limits, { seats: 3 }, "Limits should parse and normalize");
  assert.deepEqual(detail?.entitlements.metadata, { tier: "pro" }, "Metadata should parse to object");
}

async function run() {
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "projects route exports edge runtime", fn: testProjectsRouteRuntimeIsEdge },
    { name: "projects detail route succeeds", fn: testProjectsDetailRouteSuccess },
    { name: "projects detail route returns 404", fn: testProjectsDetailRouteNotFound },
    { name: "projects detail route enforces tenant", fn: testProjectsDetailRouteTenantMismatch },
    { name: "projects list route filters by company", fn: testProjectsListRouteFiltersByCompany },
    { name: "projects create route validates payload", fn: testProjectsCreateRouteValidationErrors },
    { name: "projects create route allows missing company", fn: testProjectsCreateRouteAllowsMissingCompany },
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
