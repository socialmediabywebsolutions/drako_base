import "./register-paths";
import { strict as assert } from "node:assert";
import { UnauthorizedError } from "@/lib/auth/session";
import { runtime } from "@/app/api/projects/[id]/entitlements/route";
import * as projectEntitlementsRoute from "@/app/api/projects/[id]/entitlements/route";
import {
  ProjectsDbMock,
  installDbMocks,
  installRequireTenantAccessMock,
  resetModuleStubs,
  createRequest,
} from "./test-utils/projects-test-helpers";

type EntitlementsResponse = {
  ok?: boolean;
  tenantId?: string;
  projectId?: string;
  entitlements?: {
    enabledFeatures: string[];
    enabledPacks: string[];
    limits: Record<string, number>;
    metadata: Record<string, unknown> | null;
    updatedAt: string | null;
  };
  error?: string;
};

async function testRuntimeIsEdge() {
  assert.equal(runtime, "edge", "Entitlements API route should export edge runtime");
}

async function testEntitlementsValidationErrors() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_entitlements_validate",
    tenant_id: "tenant_entitlements",
    company_id: null,
    name: "Entitlements Validate",
    slug: "entitlements-validate",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_entitlements");

  try {
    const invalidFeatures = await projectEntitlementsRoute.PUT(
      createRequest("https://example.test/api/projects/proj_entitlements_validate/entitlements", {
        method: "PUT",
        body: JSON.stringify({ enabled_features: "oops", enabled_packs: [], limits: {}, metadata: {} }),
      }),
      { params: Promise.resolve({ id: "proj_entitlements_validate" }) },
    );
    assert.equal(invalidFeatures.status, 400, "Non-array features should fail with 400");

    const invalidLimits = await projectEntitlementsRoute.PUT(
      createRequest("https://example.test/api/projects/proj_entitlements_validate/entitlements", {
        method: "PUT",
        body: JSON.stringify({ enabled_features: ["ok"], enabled_packs: ["ok"], limits: "oops", metadata: {} }),
      }),
      { params: Promise.resolve({ id: "proj_entitlements_validate" }) },
    );
    assert.equal(invalidLimits.status, 400, "Non-object limits should fail with 400");

    const tooMany = await projectEntitlementsRoute.PUT(
      createRequest("https://example.test/api/projects/proj_entitlements_validate/entitlements", {
        method: "PUT",
        body: JSON.stringify({
          enabled_features: Array.from({ length: 201 }, (_, i) => `feat-${i}`),
          enabled_packs: ["ok"],
          limits: {},
          metadata: {},
        }),
      }),
      { params: Promise.resolve({ id: "proj_entitlements_validate" }) },
    );
    assert.equal(tooMany.status, 400, "Too many features should fail with 400");
  } finally {
    resetModuleStubs();
  }
}

async function testEntitlementsTenantMismatch() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_entitlements", {
    error: new UnauthorizedError("TENANT_MISMATCH", 403),
  });

  try {
    const response = await projectEntitlementsRoute.GET(
      createRequest("https://example.test/api/projects/proj_forbidden/entitlements"),
      { params: Promise.resolve({ id: "proj_forbidden" }) },
    );
    assert.equal(response.status, 403, "Tenant mismatch should return 403");
    const payload = (await response.json()) as EntitlementsResponse;
    assert.equal(payload.ok, false, "Payload should indicate failure");
    assert.equal(payload.error, "TENANT_MISMATCH", "Error should bubble from auth guard");
  } finally {
    resetModuleStubs();
  }
}

async function run() {
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    { name: "entitlements route exports edge runtime", fn: testRuntimeIsEdge },
    { name: "entitlements GET returns defaults", fn: testEntitlementsGetDefaults },
    { name: "entitlements PUT creates with normalization", fn: testEntitlementsPutCreatesAndNormalizes },
    { name: "entitlements PUT updates existing", fn: testEntitlementsPutUpdatesExisting },
    { name: "entitlements PUT validates payload", fn: testEntitlementsValidationErrors },
    { name: "entitlements routes enforce tenant", fn: testEntitlementsTenantMismatch },
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

  console.log("✅ All project entitlements API tests passed");
}

run().catch((error) => {
  console.error("❌ Unexpected project entitlements API test failure");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});

async function testEntitlementsPutUpdatesExisting() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_entitlements_update",
    tenant_id: "tenant_entitlements",
    company_id: null,
    name: "Entitlements Update",
    slug: "entitlements-update",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });
  mock.seedEntitlements({
    tenant_id: "tenant_entitlements",
    project_id: "proj_entitlements_update",
    packs_json: JSON.stringify(["starter"]),
    features_json: JSON.stringify(["alpha"]),
    limits_json: JSON.stringify({ seats: 1 }),
    metadata_json: JSON.stringify({ tier: "starter" }),
    updated_at: "2025-01-02T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_entitlements");

  try {
    const response = await projectEntitlementsRoute.PUT(
      createRequest("https://example.test/api/projects/proj_entitlements_update/entitlements", {
        method: "PUT",
        body: JSON.stringify({
          enabled_features: ["core", "automation"],
          enabled_packs: ["scale"],
          limits: { seats: 25, automations: 50 },
          metadata: { tier: "scale" },
        }),
      }),
      { params: Promise.resolve({ id: "proj_entitlements_update" }) },
    );

    assert.equal(response.status, 200, "PUT should succeed");
    const payload = (await response.json()) as EntitlementsResponse;
    assert.equal(payload.ok, true, "Payload should mark success");
    assert.deepEqual(payload.entitlements?.enabledFeatures, ["automation", "core"], "Features should update");
    assert.deepEqual(payload.entitlements?.enabledPacks, ["scale"], "Packs should update");
    assert.deepEqual(payload.entitlements?.limits, { automations: 50, seats: 25 }, "Limits should update");
    assert.deepEqual(payload.entitlements?.metadata, { tier: "scale" }, "Metadata should update");
  } finally {
    resetModuleStubs();
  }
}

async function testEntitlementsPutCreatesAndNormalizes() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_entitlements_create",
    tenant_id: "tenant_entitlements",
    company_id: null,
    name: "Entitlements Create",
    slug: "entitlements-create",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_entitlements");

  try {
    const putResponse = await projectEntitlementsRoute.PUT(
      createRequest("https://example.test/api/projects/proj_entitlements_create/entitlements", {
        method: "PUT",
        body: JSON.stringify({
          enabled_features: ["Beta", "alpha", "beta"],
          enabled_packs: ["Growth", "starter", "growth"],
          limits: { seats: 5, visitors: "10" },
          metadata: { tier: "pro" },
        }),
      }),
      { params: Promise.resolve({ id: "proj_entitlements_create" }) },
    );

    assert.equal(putResponse.status, 200, "PUT should succeed");
    const putPayload = (await putResponse.json()) as EntitlementsResponse;
    assert.equal(putPayload.ok, true, "PUT payload should indicate success");
    assert.deepEqual(
      putPayload.entitlements?.enabledFeatures,
      ["alpha", "beta"],
      "Features should normalize to lowercase sorted unique",
    );
    assert.deepEqual(
      putPayload.entitlements?.enabledPacks,
      ["growth", "starter"],
      "Packs should normalize to lowercase sorted unique",
    );
    assert.deepEqual(putPayload.entitlements?.limits, { seats: 5, visitors: 10 }, "Limits should coerce to numbers");
    assert.deepEqual(putPayload.entitlements?.metadata, { tier: "pro" }, "Metadata should persist");
    assert.ok(putPayload.entitlements?.updatedAt, "Mutation should set updated timestamp");

    const getResponse = await projectEntitlementsRoute.GET(
      createRequest("https://example.test/api/projects/proj_entitlements_create/entitlements"),
      { params: Promise.resolve({ id: "proj_entitlements_create" }) },
    );
    assert.equal(getResponse.status, 200, "GET after mutation should succeed");
    const getPayload = (await getResponse.json()) as EntitlementsResponse;
    assert.deepEqual(getPayload.entitlements?.enabledFeatures, ["alpha", "beta"], "GET should return normalized features");
    assert.deepEqual(getPayload.entitlements?.enabledPacks, ["growth", "starter"], "GET should return normalized packs");
    assert.deepEqual(getPayload.entitlements?.limits, { seats: 5, visitors: 10 }, "GET should return normalized limits");
    assert.deepEqual(getPayload.entitlements?.metadata, { tier: "pro" }, "GET should return metadata");
  } finally {
    resetModuleStubs();
  }
}

async function testEntitlementsGetDefaults() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_entitlements_defaults",
    tenant_id: "tenant_entitlements",
    company_id: null,
    name: "Entitlements Defaults",
    slug: "entitlements-defaults",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_entitlements");

  try {
    const response = await projectEntitlementsRoute.GET(
      createRequest("https://example.test/api/projects/proj_entitlements_defaults/entitlements"),
      { params: Promise.resolve({ id: "proj_entitlements_defaults" }) },
    );
    assert.equal(response.status, 200, "GET with no entitlements row should succeed");

    const payload = (await response.json()) as EntitlementsResponse;
    assert.equal(payload.ok, true, "Response should indicate success");
    assert.equal(payload.tenantId, "tenant_entitlements", "Tenant should echo back");
    assert.equal(payload.projectId, "proj_entitlements_defaults", "Project should echo back");
    assert.deepEqual(payload.entitlements?.enabledFeatures, [], "Features should default to empty array");
    assert.deepEqual(payload.entitlements?.enabledPacks, [], "Packs should default to empty array");
    assert.deepEqual(payload.entitlements?.limits, {}, "Limits should default to empty object");
    assert.equal(payload.entitlements?.metadata, null, "Metadata should default to null");
    assert.equal(payload.entitlements?.updatedAt, null, "UpdatedAt should default to null");
  } finally {
    resetModuleStubs();
  }
}
