import "./register-paths";
import { strict as assert } from "node:assert";
import { UnauthorizedError } from "@/lib/auth/session";
import * as projectDomainsRoute from "@/app/api/projects/[id]/domains/route";
import * as projectDomainsVerifyRoute from "@/app/api/projects/[id]/domains/verify/route";
import {
  ProjectsDbMock,
  installDbMocks,
  installRequireTenantAccessMock,
  resetModuleStubs,
  createRequest,
  stubProjectDomainVerification,
} from "./test-utils/projects-test-helpers";

async function testCreateProjectDomainReturnsPending() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_domains_create",
    tenant_id: "tenant_domains",
    company_id: null,
    name: "Domains Create",
    slug: "domains-create",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_domains");

  try {
    const response = await projectDomainsRoute.POST(
      createRequest("https://example.test/api/projects/proj_domains_create/domains", {
        method: "POST",
        body: JSON.stringify({ domain: "Example.COM" }),
      }),
      { params: Promise.resolve({ id: "proj_domains_create" }) },
    );

    assert.equal(response.status, 201, "Creating domain should return 201");
    const payload = (await response.json()) as {
      ok?: boolean;
      item?: { domain: string; status: string };
    };
    assert.equal(payload.ok, true, "Response should indicate success");
    assert.equal(payload.item?.status, "pending", "Created domain should be pending");
    assert.equal(payload.item?.domain, "example.com", "Domain should be normalized to lowercase");
    assert.equal(mock.domains.length, 1, "Domain should be stored in mock DB");
    assert.equal(mock.domains[0]?.status, "pending", "Stored status should remain pending");
  } finally {
    resetModuleStubs();
  }
}

async function testCreateProjectDomainDeduplicates() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_domains_dup",
    tenant_id: "tenant_domains",
    company_id: null,
    name: "Domains Dup",
    slug: "domains-dup",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_domains");

  try {
    const first = await projectDomainsRoute.POST(
      createRequest("https://example.test/api/projects/proj_domains_dup/domains", {
        method: "POST",
        body: JSON.stringify({ domain: "dup.example" }),
      }),
      { params: Promise.resolve({ id: "proj_domains_dup" }) },
    );
    assert.equal(first.status, 201, "First create should succeed with 201");

    const second = await projectDomainsRoute.POST(
      createRequest("https://example.test/api/projects/proj_domains_dup/domains", {
        method: "POST",
        body: JSON.stringify({ domain: "dup.example" }),
      }),
      { params: Promise.resolve({ id: "proj_domains_dup" }) },
    );

    assert.equal(second.status, 200, "Duplicate create should return 200");
    const payload = (await second.json()) as { ok?: boolean; duplicated?: boolean };
    assert.equal(payload.ok, true, "Duplicate response should still be ok");
    assert.equal(payload.duplicated, true, "Should flag duplicate");
    assert.equal(mock.domains.length, 1, "No additional domain should be inserted");
  } finally {
    resetModuleStubs();
  }
}

async function testListProjectDomainsIncludesCreated() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_domains_list",
    tenant_id: "tenant_domains",
    company_id: null,
    name: "Domains List",
    slug: "domains-list",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  });
  mock.seedDomain({
    id: "projdom_seed",
    tenant_id: "tenant_domains",
    project_id: "proj_domains_list",
    domain: "seed.example",
    status: "pending",
    verification_token: null,
    last_error: null,
    created_at: "2025-01-03T00:00:00Z",
    updated_at: "2025-01-03T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_domains");

  try {
    const response = await projectDomainsRoute.GET(
      createRequest("https://example.test/api/projects/proj_domains_list/domains"),
      { params: Promise.resolve({ id: "proj_domains_list" }) },
    );

    assert.equal(response.status, 200, "Listing domains should return 200");
    const payload = (await response.json()) as {
      ok?: boolean;
      items?: Array<{ id: string; domain: string }>;
    };
    assert.equal(payload.ok, true, "List response should indicate success");
    assert.ok(payload.items && payload.items.length === 1, "List should include seeded domain");
    assert.equal(payload.items?.[0]?.domain, "seed.example", "Seeded domain should surface");
  } finally {
    resetModuleStubs();
  }
}

async function testVerifyProjectDomainUpdatesStatus() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_domains_verify",
    tenant_id: "tenant_domains",
    company_id: null,
    name: "Domains Verify",
    slug: "domains-verify",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-02T00:00:00Z",
  });
  mock.seedDomain({
    id: "projdom_verify",
    tenant_id: "tenant_domains",
    project_id: "proj_domains_verify",
    domain: "verify.example",
    status: "pending",
    verification_token: null,
    last_error: "DNS_PENDING",
    created_at: "2025-01-03T00:00:00Z",
    updated_at: "2025-01-03T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_domains");
  stubProjectDomainVerification({
    tenantId: "tenant_domains",
    projectId: "proj_domains_verify",
    domain: "verify.example",
    result: { status: "verified" },
  });

  try {
    const response = await projectDomainsVerifyRoute.POST(
      createRequest("https://example.test/api/projects/proj_domains_verify/domains/verify", {
        method: "POST",
        body: JSON.stringify({ domainId: "projdom_verify" }),
      }),
      { params: Promise.resolve({ id: "proj_domains_verify" }) },
    );

    assert.equal(response.status, 200, "Verification should succeed with 200");
    const payload = (await response.json()) as {
      ok?: boolean;
      items?: Array<{ id: string; status: string; lastError: string | null }>;
    };
    assert.equal(payload.ok, true, "Verification response should indicate success");
    const updated = mock.domains.find((domain) => domain.id === "projdom_verify");
    assert.ok(updated, "Domain should exist after verification");
    assert.equal(updated?.status, "verified", "Domain status should be updated to verified");
    assert.equal(updated?.last_error, null, "Last error should be cleared after success");
  } finally {
    resetModuleStubs();
  }
}

async function testProjectDomainTenantMismatch() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_domains", {
    error: new UnauthorizedError("TENANT_MISMATCH", 403),
  });

  try {
    const response = await projectDomainsRoute.GET(
      createRequest("https://example.test/api/projects/proj_forbidden/domains"),
      { params: Promise.resolve({ id: "proj_forbidden" }) },
    );

    assert.equal(response.status, 403, "Tenant mismatch should yield 403");
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    assert.equal(payload.ok, false, "Payload should indicate failure");
    assert.equal(payload.error, "TENANT_MISMATCH", "Error should bubble from auth guard");
  } finally {
    resetModuleStubs();
  }
}

async function run() {
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "project domains create returns pending", fn: testCreateProjectDomainReturnsPending },
    { name: "project domains create deduplicates", fn: testCreateProjectDomainDeduplicates },
    { name: "project domains list includes records", fn: testListProjectDomainsIncludesCreated },
    { name: "project domains verify updates status", fn: testVerifyProjectDomainUpdatesStatus },
    { name: "project domains routes enforce tenant", fn: testProjectDomainTenantMismatch },
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

  console.log("✅ All project domains API tests passed");
}

run().catch((error) => {
  console.error("❌ Unexpected project domains API test failure");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
