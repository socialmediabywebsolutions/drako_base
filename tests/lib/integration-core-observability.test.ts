import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  definitions: [] as Array<Record<string, unknown>>,
  connections: [] as Array<Record<string, unknown>>,
  credentials: [] as Array<Record<string, unknown>>,
}));

const queryOne = vi.hoisted(() => vi.fn());
const queryAll = vi.hoisted(() => vi.fn());
const run = vi.hoisted(() => vi.fn());
const recordObservabilityActivity = vi.hoisted(() => vi.fn());
const openObservabilityIncident = vi.hoisted(() => vi.fn());
const resolveObservabilityIncidentsByScope = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  queryOne,
  queryAll,
  run,
}));

vi.mock("@/lib/observability-core", () => ({
  recordObservabilityActivity,
  openObservabilityIncident,
  resolveObservabilityIncidentsByScope,
}));

import { connectIntegration } from "@/lib/integration-core/connections";
import { registerIntegrationDefinition } from "@/lib/integration-core/definitions";
import { validateIntegrationConnection, executeIntegrationOperation } from "@/lib/integration-core/execution";
import { registerIntegrationProvider } from "@/lib/integration-core/providers";

function setupDbMocks() {
  queryOne.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_integration_definitions")) {
      return state.definitions.find((item) => item.integration_key === params[0]) ?? null;
    }
    if (sql.includes("FROM drako_integration_connections")) {
      return state.connections.find(
        (item) => item.tenant_id === params[0] && item.saas_id === params[1] && item.integration_key === params[2],
      ) ?? null;
    }
    if (sql.includes("FROM drako_integration_credentials")) {
      return state.credentials.find((item) => item.connection_id === params[0]) ?? null;
    }
    return null;
  });

  queryAll.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM drako_integration_credentials")) return [...state.credentials];
    if (sql.includes("FROM drako_integration_connections")) return [...state.connections];
    return [];
  });

  run.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.startsWith("INSERT INTO drako_integration_definitions")) {
      state.definitions.push({
        id: params[0],
        integration_key: params[1],
        display_name: params[2],
        provider: params[3],
        category: params[4],
        auth_mode: params[5],
        enabled: params[6],
        supported_operations_json: params[7],
        created_at: params[8],
        updated_at: params[9],
      });
      return true;
    }
    if (sql.startsWith("INSERT INTO drako_integration_connections")) {
      state.connections.push({
        id: params[0],
        tenant_id: params[1],
        saas_id: params[2],
        integration_key: params[3],
        connection_label: params[4],
        status: params[5],
        metadata_json: params[6],
        last_validated_at: null,
        last_error_code: null,
        last_error_message: null,
        created_at: params[7],
        updated_at: params[8],
      });
      return true;
    }
    if (sql.startsWith("INSERT INTO drako_integration_credentials")) {
      state.credentials.push({
        id: params[0],
        connection_id: params[1],
        credential_type: params[2],
        payload_json: params[3],
        created_at: params[4],
        updated_at: params[5],
      });
      return true;
    }
    if (sql.startsWith("UPDATE drako_integration_connections") && sql.includes("metadata_json")) {
      const row = state.connections.find((item) => item.id === params[6]);
      if (row) {
        row.status = params[0];
        row.metadata_json = params[1];
        row.last_validated_at = params[2];
        row.last_error_code = params[3];
        row.last_error_message = params[4];
        row.updated_at = params[5];
      }
      return true;
    }
    return true;
  });
}

describe("integration core observability integration", () => {
  beforeEach(() => {
    state.definitions = [];
    state.connections = [];
    state.credentials = [];
    vi.clearAllMocks();
    setupDbMocks();
  });

  it("records activity on successful validation and operation", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.integration",
      displayName: "Fake Integration",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["ping"],
    });
    await connectIntegration({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.integration",
      credentials: { token: "ok" },
    });
    registerIntegrationProvider("fake.integration", {
      validate: async () => ({ ok: true, status: "CONNECTED" }),
      executeOperation: async () => ({ ok: true, result: { pong: true } }),
    });

    await validateIntegrationConnection({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.integration",
    });
    await executeIntegrationOperation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.integration",
      operationKey: "ping",
    });

    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "integration",
        sourceKey: "fake.integration",
        activityType: "integration_validation",
      }),
    );
    expect(recordObservabilityActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "integration",
        sourceKey: "fake.integration",
        activityType: "integration_operation",
        status: "success",
      }),
    );
    expect(resolveObservabilityIncidentsByScope).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "integration",
        sourceKey: "fake.integration",
        incidentType: "integration_connection_invalid",
      }),
    );
    expect(resolveObservabilityIncidentsByScope).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "integration",
        sourceKey: "fake.integration",
        incidentType: "integration_operation_failed",
      }),
    );
  });

  it("opens incident on invalid connection validation", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.invalid",
      displayName: "Fake Invalid",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["ping"],
    });
    await connectIntegration({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.invalid",
      credentials: { token: "bad" },
    });
    registerIntegrationProvider("fake.invalid", {
      validate: async () => ({
        ok: false,
        status: "INVALID",
        error: { code: "BAD_TOKEN", message: "Token invalid" },
      }),
      executeOperation: async () => ({ ok: true, result: null }),
    });

    await validateIntegrationConnection({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.invalid",
    });

    expect(openObservabilityIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "integration",
        sourceKey: "fake.invalid",
        incidentType: "integration_connection_invalid",
      }),
    );
  });

  it("opens incident on failed integration operation", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.operation.fail",
      displayName: "Fake Operation Fail",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["publish"],
    });
    await connectIntegration({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.operation.fail",
      credentials: { token: "ok" },
      status: "CONNECTED",
    });
    registerIntegrationProvider("fake.operation.fail", {
      validate: async () => ({ ok: true, status: "CONNECTED" }),
      executeOperation: async () => ({
        ok: false,
        error: { code: "HTTP_500", message: "Provider failed" },
      }),
    });

    await expect(
      executeIntegrationOperation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        integrationKey: "fake.operation.fail",
        operationKey: "publish",
      }),
    ).rejects.toMatchObject({ code: "HTTP_500" });

    expect(openObservabilityIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "integration",
        sourceKey: "fake.operation.fail",
        incidentType: "integration_operation_failed",
      }),
    );
  });
});
