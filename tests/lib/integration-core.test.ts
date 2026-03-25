import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  definitions: [] as Array<Record<string, unknown>>,
  connections: [] as Array<Record<string, unknown>>,
  credentials: [] as Array<Record<string, unknown>>,
}));

const queryOne = vi.hoisted(() => vi.fn());
const queryAll = vi.hoisted(() => vi.fn());
const run = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  queryOne,
  queryAll,
  run,
}));

import {
  IntegrationCoreError,
  connectIntegration,
  executeIntegrationOperation,
  getIntegrationConnection,
  listIntegrationConnections,
  listIntegrationDefinitions,
  registerIntegrationDefinition,
  registerIntegrationProvider,
  validateIntegrationConnection,
} from "@/lib/integration-core";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setupDbMocks() {
  queryOne.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_integration_definitions")) {
      const [integrationKey] = params;
      const row = state.definitions.find((item) => item.integration_key === integrationKey);
      return row ? clone(row) : null;
    }

    if (sql.includes("FROM drako_integration_connections")) {
      const [tenantId, saasId, integrationKey] = params;
      const row = state.connections.find(
        (item) => item.tenant_id === tenantId && item.saas_id === saasId && item.integration_key === integrationKey,
      );
      return row ? clone(row) : null;
    }

    if (sql.includes("FROM drako_integration_credentials")) {
      const [connectionId] = params;
      const row = state.credentials.find((item) => item.connection_id === connectionId);
      return row ? clone(row) : null;
    }

    return null;
  });

  queryAll.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_integration_definitions")) {
      return clone([...state.definitions].sort((a, b) => String(a.display_name).localeCompare(String(b.display_name))));
    }

    if (sql.includes("FROM drako_integration_connections")) {
      let rows = [...state.connections];
      let cursor = 0;
      if (sql.includes("tenant_id = ?")) {
        rows = rows.filter((item) => item.tenant_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("saas_id = ?")) {
        rows = rows.filter((item) => item.saas_id === params[cursor]);
        cursor += 1;
      }
      if (sql.includes("integration_key = ?")) {
        rows = rows.filter((item) => item.integration_key === params[cursor]);
      }
      return clone(rows);
    }

    if (sql.includes("FROM drako_integration_credentials")) {
      return clone(state.credentials);
    }

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

    if (sql.startsWith("UPDATE drako_integration_definitions")) {
      const row = state.definitions.find((item) => item.integration_key === params[7]);
      if (row) {
        row.display_name = params[0];
        row.provider = params[1];
        row.category = params[2];
        row.auth_mode = params[3];
        row.enabled = params[4];
        row.supported_operations_json = params[5];
        row.updated_at = params[6];
      }
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

    if (sql.startsWith("UPDATE drako_integration_connections") && sql.includes("connection_label")) {
      const row = state.connections.find((item) => item.id === params[4]);
      if (row) {
        row.connection_label = params[0];
        row.status = params[1];
        row.metadata_json = params[2];
        row.updated_at = params[3];
      }
      return true;
    }

    if (sql.startsWith("UPDATE drako_integration_connections") && sql.includes("SET status = ?, metadata_json")) {
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

    if (sql.startsWith("UPDATE drako_integration_connections") && sql.includes("SET status = 'DISCONNECTED'")) {
      const row = state.connections.find((item) => item.id === params[1]);
      if (row) {
        row.status = "DISCONNECTED";
        row.last_error_code = null;
        row.last_error_message = null;
        row.updated_at = params[0];
      }
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

    if (sql.startsWith("UPDATE drako_integration_credentials")) {
      const row = state.credentials.find((item) => item.connection_id === params[2]);
      if (row) {
        row.payload_json = params[0];
        row.updated_at = params[1];
      }
      return true;
    }

    return true;
  });
}

describe("integration core", () => {
  beforeEach(() => {
    state.definitions = [];
    state.connections = [];
    state.credentials = [];
    vi.clearAllMocks();
    setupDbMocks();
  });

  it("rejects connection when definition does not exist", async () => {
    await expect(
      connectIntegration({
        tenantId: "tenant-a",
        saasId: "saas-a",
        integrationKey: "missing",
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_DEFINITION_NOT_FOUND" satisfies IntegrationCoreError["code"] });
  });

  it("registers definitions and lists them", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.integration",
      displayName: "Fake Integration",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["ping"],
    });

    const definitions = await listIntegrationDefinitions();
    expect(definitions).toHaveLength(1);
    expect(definitions[0].integrationKey).toBe("fake.integration");
  });

  it("rejects validation when provider is not registered", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.validation",
      displayName: "Fake Validation",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["ping"],
    });
    await connectIntegration({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.validation",
      credentials: { token: "abc" },
    });

    await expect(
      validateIntegrationConnection({
        tenantId: "tenant-a",
        saasId: "saas-a",
        integrationKey: "fake.validation",
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_PROVIDER_NOT_REGISTERED" satisfies IntegrationCoreError["code"] });
  });

  it("tracks invalid connections and blocks execution", async () => {
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
      executeOperation: async () => ({
        ok: true,
        result: { pong: true },
      }),
    });

    const validation = await validateIntegrationConnection({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.invalid",
    });

    expect(validation.ok).toBe(false);
    const updated = await getIntegrationConnection("tenant-a", "saas-a", "fake.invalid");
    expect(updated?.status).toBe("INVALID");

    await expect(
      executeIntegrationOperation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        integrationKey: "fake.invalid",
        operationKey: "ping",
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_INVALID" satisfies IntegrationCoreError["code"] });
  });

  it("executes an operation successfully for a valid connection", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.ok",
      displayName: "Fake OK",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["ping"],
    });
    await connectIntegration({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.ok",
      credentials: { token: "good" },
    });

    registerIntegrationProvider("fake.ok", {
      validate: async ({ connection }) => ({
        ok: true,
        status: "CONNECTED",
        metadata: { label: connection.connectionLabel ?? "ok" },
      }),
      executeOperation: async ({ payload }) => ({
        ok: true,
        result: { echoed: payload?.value ?? null },
      }),
    });

    await validateIntegrationConnection({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.ok",
    });

    const result = await executeIntegrationOperation({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.ok",
      operationKey: "ping",
      payload: { value: "pong" },
    });

    expect(result.ok).toBe(true);
    expect(result.result?.echoed).toBe("pong");
  });

  it("keeps connections separated by tenantId and saasId", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.shared",
      displayName: "Fake Shared",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["ping"],
    });
    await connectIntegration({
      tenantId: "tenant-a",
      saasId: "saas-a",
      integrationKey: "fake.shared",
      credentials: { token: "one" },
    });
    await connectIntegration({
      tenantId: "tenant-a",
      saasId: "saas-b",
      integrationKey: "fake.shared",
      credentials: { token: "two" },
    });

    const tenantAConnections = await listIntegrationConnections({ tenantId: "tenant-a", saasId: "saas-a" });
    const tenantBConnections = await listIntegrationConnections({ tenantId: "tenant-a", saasId: "saas-b" });

    expect(tenantAConnections).toHaveLength(1);
    expect(tenantBConnections).toHaveLength(1);
    expect(tenantAConnections[0].credentials).toEqual({ token: "one" });
    expect(tenantBConnections[0].credentials).toEqual({ token: "two" });
  });

  it("rejects execution when connection does not exist", async () => {
    await registerIntegrationDefinition({
      integrationKey: "fake.missing.connection",
      displayName: "Fake Missing Connection",
      provider: "fake",
      category: "other",
      authMode: "custom",
      supportedOperations: ["ping"],
    });
    registerIntegrationProvider("fake.missing.connection", {
      validate: async () => ({ ok: true, status: "CONNECTED" }),
      executeOperation: async () => ({ ok: true, result: { pong: true } }),
    });

    await expect(
      executeIntegrationOperation({
        tenantId: "tenant-a",
        saasId: "saas-a",
        integrationKey: "fake.missing.connection",
        operationKey: "ping",
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_CONNECTION_NOT_FOUND" satisfies IntegrationCoreError["code"] });
  });
});
