import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  items: [] as Array<Record<string, unknown>>,
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
  archiveFactorySaas,
  getFactorySaas,
  listFactorySaas,
  registerFactorySaas,
  setFactorySaasStatus,
} from "@/lib/factory/registry";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function setupDbMocks() {
  queryOne.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_factory_saas_registry")) {
      const [saasId] = params;
      const row = state.items.find((item) => item.saas_id === saasId);
      return row ? clone(row) : null;
    }

    return null;
  });

  queryAll.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.includes("FROM drako_factory_saas_registry")) {
      let rows = [...state.items];
      if (sql.includes("status = ?")) {
        rows = rows.filter((item) => item.status === params[0]);
      }
      rows.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
      return clone(rows);
    }

    return [];
  });

  run.mockImplementation(async (sql: string, ...params: unknown[]) => {
    if (sql.startsWith("INSERT INTO drako_factory_saas_registry")) {
      state.items.push({
        saas_id: params[0],
        display_name: params[1],
        template: params[2],
        status: params[3],
        created_by: params[4],
        supports_operator_surface: params[5],
        metadata_json: params[6],
        created_at: params[7],
        updated_at: params[8],
      });
      return true;
    }

    if (sql.startsWith("UPDATE drako_factory_saas_registry") && sql.includes("display_name")) {
      const row = state.items.find((item) => item.saas_id === params[7]);
      if (row) {
        row.display_name = params[0];
        row.template = params[1];
        row.status = params[2];
        row.created_by = params[3];
        row.supports_operator_surface = params[4];
        row.metadata_json = params[5];
        row.updated_at = params[6];
      }
      return true;
    }

    if (sql.startsWith("UPDATE drako_factory_saas_registry") && sql.includes("SET status = ?, updated_at = ?")) {
      const row = state.items.find((item) => item.saas_id === params[2]);
      if (row) {
        row.status = params[0];
        row.updated_at = params[1];
      }
      return true;
    }

    return true;
  });
}

describe("factory registry", () => {
  beforeEach(() => {
    state.items = [];
    vi.clearAllMocks();
    setupDbMocks();
  });

  it("registers and lists factory SaaS entries", async () => {
    await registerFactorySaas({
      saasId: "runtime_ops_alpha",
      displayName: "Runtime Ops Alpha",
      template: "basic-operational-saas",
      supportsOperatorSurface: true,
      metadata: { operatorTenantId: "tenant_factory" },
    });

    const item = await getFactorySaas("runtime_ops_alpha");
    const items = await listFactorySaas();

    expect(item?.status).toBe("ACTIVE");
    expect(item?.supportsOperatorSurface).toBe(true);
    expect(items).toHaveLength(1);
  });

  it("updates lifecycle status and archives entries", async () => {
    await registerFactorySaas({
      saasId: "runtime_ops_beta",
      displayName: "Runtime Ops Beta",
    });

    const degraded = await setFactorySaasStatus("runtime_ops_beta", "DEGRADED");
    const archived = await archiveFactorySaas("runtime_ops_beta");

    expect(degraded.status).toBe("DEGRADED");
    expect(archived.status).toBe("ARCHIVED");
  });
});
