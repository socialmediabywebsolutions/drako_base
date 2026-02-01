import "./register-paths";
import { strict as assert } from "node:assert";

import { UnauthorizedError } from "@/lib/auth/session";
const contextModule = require("@/lib/orchestrator/company-context") as typeof import("@/lib/orchestrator/company-context");
import type { SaasPackDefinition } from "@/lib/packs/types";
// runtime export removed for OpenNext compatibility
import * as entitlementsContextRoute from "@/app/api/projects/[id]/entitlements/context/route";
import {
  ProjectsDbMock,
  installDbMocks,
  installRequireTenantAccessMock,
  resetModuleStubs,
  createRequest,
} from "./test-utils/projects-test-helpers";

const ORIGINAL_CONTEXT_RESOLVER = contextModule.resolveCompanyFeaturePackContext;

type ContextResponse = {
  ok?: boolean;
  error?: string;
  tenantId?: string;
  projectId?: string;
  companyId?: string | null;
  resolvedSaasId?: string | null;
  projectEntitlements?: {
    enabledFeatures: string[];
    enabledPacks: string[];
    limits: Record<string, number>;
    metadata: Record<string, unknown> | null;
    updatedAt: string | null;
  };
  inheritedContext?: {
    source: string;
    resolvedSaasId: string | null;
    features: Array<{ featureKey: string; source: string }>;
    packs: Array<SaasPackDefinition & { source: string }>;
    errors: string[];
  };
};

/* OpenNext: edge runtime test disabled
async function testRuntimeExportsEdge() {
  assert.equal(runtime, "edge", "Context route should expose edge runtime");
}
*/

async function testContextReturnsInheritedData() {
  const mock = new ProjectsDbMock();
  mock.seedProject({
    id: "proj_context_success",
    tenant_id: "tenant_context",
    company_id: "company_alpha",
    name: "Context project",
    slug: "context-project",
    status: "active",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  });
  mock.seedEntitlements({
    tenant_id: "tenant_context",
    project_id: "proj_context_success",
    packs_json: JSON.stringify(["starter"]),
    features_json: JSON.stringify(["alpha"]),
    limits_json: JSON.stringify({ seats: 3 }),
    metadata_json: JSON.stringify({ tier: "starter" }),
    updated_at: "2025-01-02T00:00:00Z",
  });

  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_context");

  contextModule.resolveCompanyFeaturePackContext = async () => ({
    features: [
      {
        id: "feature_economy",
        tenantId: "tenant_context",
        saasId: "company_alpha",
        featureKey: "ECONOMY",
        label: "Economy",
        category: "CORE",
        status: "ENABLED",
        source: "MANUAL",
        phaseOrder: 1,
        metadata: null,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      },
    ],
    packs: [
      {
        id: "drako_clinic_pack",
        slug: "clinic",
        label: "Drako Clinic Pack",
        vertical: "CLINIC",
        description: "Clinic",
        recommendedFeatureKeys: [],
        recommendedBlueprintModuleKeys: [],
        recommendedKnowledgeTags: [],
        catalog: undefined,
        source: "company",
      } as SaasPackDefinition & { source: string },
    ],
    resolvedSaasId: "company_alpha",
    errors: [],
  });

  try {
    const response = await entitlementsContextRoute.GET(
      createRequest("https://example.test/api/projects/proj_context_success/entitlements/context"),
      { params: Promise.resolve({ id: "proj_context_success" }) },
    );
    assert.equal(response.status, 200, "Context endpoint should return 200");
    const payload = (await response.json()) as ContextResponse;
    assert.equal(payload.ok, true, "Payload should indicate success");
    assert.equal(payload.projectId, "proj_context_success", "Should echo project id");
    assert.equal(payload.companyId, "company_alpha", "Should echo company id");
    assert.equal(payload.resolvedSaasId, "company_alpha", "Resolved SaaS id should surface");
    assert.equal(payload.inheritedContext?.source, "company", "Source should show company fallback");
    assert.equal(payload.inheritedContext?.features[0]?.featureKey, "ECONOMY", "Feature should appear in payload");
  } finally {
    resetModuleStubs();
    contextModule.resolveCompanyFeaturePackContext = ORIGINAL_CONTEXT_RESOLVER;
  }
}

async function testProjectNotFound() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_context");

  try {
    const response = await entitlementsContextRoute.GET(
      createRequest("https://example.test/api/projects/nonexistent/entitlements/context"),
      { params: Promise.resolve({ id: "nonexistent" }) },
    );
    assert.equal(response.status, 404, "Non-existent project should return 404");
    const payload = (await response.json()) as ContextResponse;
    assert.equal(payload.ok, false, "Payload should indicate failure");
  } finally {
    resetModuleStubs();
  }
}

async function testTenantMismatch() {
  const mock = new ProjectsDbMock();
  installDbMocks(mock);
  installRequireTenantAccessMock("tenant_context", {
    error: new UnauthorizedError("TENANT_MISMATCH", 403),
  });

  try {
    const response = await entitlementsContextRoute.GET(
      createRequest("https://example.test/api/projects/proj_forbidden/entitlements/context"),
      { params: Promise.resolve({ id: "proj_forbidden" }) },
    );
    assert.equal(response.status, 403, "Tenant mismatch should return 403");
    const payload = (await response.json()) as ContextResponse;
    assert.equal(payload.ok, false, "Payload should signal failure");
    assert.equal(payload.error, "TENANT_MISMATCH", "Error should propagate from auth guard");
  } finally {
    resetModuleStubs();
  }
}

async function run() {
  const tests: Array<{ name: string; fn: () => Promise<void> }> = [
    // { name: "context route exports edge runtime", fn: testRuntimeExportsEdge }, // OpenNext: disabled
    { name: "context GET returns inherited data", fn: testContextReturnsInheritedData },
    { name: "context GET returns 404 for missing project", fn: testProjectNotFound },
    { name: "context GET enforces tenant access", fn: testTenantMismatch },
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

  console.log("✅ All project entitlements context API tests passed");
}

run().catch((error) => {
  console.error("❌ Unexpected failure in project entitlements context tests");
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
