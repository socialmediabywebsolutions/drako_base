import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertSafeSocialflowNonprodSourceBootstrapSql,
  runBootstrapSocialflowNonprodSourceData,
  type SocialflowNonprodSourceBootstrapRemoteCommand,
} from "../scripts/bootstrap-socialflow-nonprod-source-data";

const REAL_NONPROD_CONFIG = `
name = "saas-socialflows-runtime-canary-nonprod"

[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_socialflow_canary"
database_id = "ca873dbd-2c44-49ae-bf14-e1ce7f217fde"

[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_socialflows_registry_canary_db"
database_id = "6951995a-141f-4338-acc5-f65be3d8c91e"

[[d1_databases]]
binding = "SOCIAL_DB"
database_name = "saas_socialflows_canary_db"
database_id = "349fa685-044e-4292-b6e9-b1cafd35896e"

[[d1_databases]]
binding = "SOCIALFLOW_AUTHS_DB"
database_name = "saas_socialflow_auths_canary_db"
database_id = "213b115b-9363-4a21-82d6-8db58c98d6df"

[vars]
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
`;

type MockRunnerState = {
  commands: SocialflowNonprodSourceBootstrapRemoteCommand[];
  tables?: Record<string, Record<string, unknown>[]>;
};

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-nonprod-source-bootstrap-"));
  const configPath = path.join(tmpDir, "wrangler.toml");
  await fs.writeFile(configPath, source, "utf8");
  return configPath;
}

function jsonRows(rows: Record<string, unknown>[]): string {
  return JSON.stringify([{ results: rows }]);
}

function tableNameFromExistenceSql(sql: string): string | null {
  const match = sql.match(/sqlite_master.+name = '([^']+)'/s);
  return match?.[1] ?? null;
}

function rowReadFromSql(sql: string): { table: string; keyField: string; keyValue: string } | null {
  const match = sql.match(/^SELECT \* FROM ([a-zA-Z0-9_]+) WHERE ([a-zA-Z0-9_]+) = '([^']+)';$/);
  return match ? { table: match[1], keyField: match[2], keyValue: match[3] } : null;
}

function countSqlFromSql(sql: string): string | null {
  const match = sql.match(/^SELECT COUNT\(\*\) AS count FROM ([a-zA-Z0-9_]+);$/);
  return match?.[1] ?? null;
}

function createMockRunner(state: MockRunnerState) {
  return (command: SocialflowNonprodSourceBootstrapRemoteCommand): string => {
    state.commands.push(command);
    const tables = state.tables ?? {};
    const existsName = tableNameFromExistenceSql(command.sql);
    if (existsName) {
      return Object.prototype.hasOwnProperty.call(tables, existsName) ? jsonRows([{ name: existsName }]) : jsonRows([]);
    }
    const rowRead = rowReadFromSql(command.sql);
    if (rowRead) {
      return jsonRows((tables[rowRead.table] ?? []).filter((row) => String(row[rowRead.keyField]) === rowRead.keyValue));
    }
    const countTable = countSqlFromSql(command.sql);
    if (countTable) {
      return jsonRows([{ count: tables[countTable]?.length ?? 0 }]);
    }
    return jsonRows([]);
  };
}

function seededTables() {
  return {
    tenants: [{ tenant_id: "tenant_socialflow_canary", name: "SocialFlow Canary Tenant", materialization_step: 1 }],
    saas: [{
      id: "saas_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      slug: "socialflow",
      name: "SocialFlow Canary SaaS",
      domain: "socialflow-canary.local",
      status: "active",
      blueprint_snapshot: JSON.stringify({ source: "canary", product: "socialflow", synthetic: true }),
      mrr_eur: 0,
      cost_eur: 0,
      risk_level: "low",
      plan_tier: "canary",
    }],
    saas_domains: [{ id: "domain_socialflow_canary", tenant_id: "tenant_socialflow_canary", saas_id: "saas_socialflow_canary", domain: "socialflow-canary.local", status: "active" }],
    tenant_strategic_dossiers: [{
      id: "dossier_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      status: "ready",
      version: 1,
      form_data: JSON.stringify({ objective: "canary validation", containsPersonalData: false }),
      analysis_data: JSON.stringify({ summary: "synthetic canary dossier" }),
      plan_data: JSON.stringify({ nextStep: "nonprod parity" }),
    }],
    agent_work_logs: [{
      id: "worklog_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      agent_name: "canary-agent",
      action_type: "canary-bootstrap",
      status: "completed",
      output_json: JSON.stringify({ synthetic: true, result: "ok" }),
      cost_eur: 0,
    }],
    orchestrator_messages: [{ id: "message_socialflow_canary", tenant_id: "tenant_socialflow_canary", role: "system", content: "Synthetic SocialFlow canary source message." }],
    economic_events: [{
      id: "event_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      type: "canary",
      severity: "info",
      payload_json: JSON.stringify({ synthetic: true, value: 0 }),
    }],
  };
}

describe("SocialFlow nonprod source data bootstrap", () => {
  it("rejects a DB with prod in the name", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace("drako_db_socialflow_canary", "drako_db_prod"),
    );

    await expect(runBootstrapSocialflowNonprodSourceData({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    })).rejects.toThrow("SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_DATABASE");
  });

  it("rejects switch ON", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace(
        'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"',
        'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"',
      ),
    );

    await expect(runBootstrapSocialflowNonprodSourceData({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    })).rejects.toThrow("SOCIALFLOW_NONPROD_CANARY_CONFIG_SWITCH_NOT_OFF");
  });

  it("rejects deployable=true", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace(
        'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"',
        'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"\nSOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"',
      ),
    );

    await expect(runBootstrapSocialflowNonprodSourceData({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    })).rejects.toThrow("SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_UNSAFE_STATUS");
  });

  it("dry-run does not write", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = { commands: [] };
    const report = await runBootstrapSocialflowNonprodSourceData({
      mode: "dry-run",
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    expect(report.status).toBe("DRY_RUN_OK");
    expect(report.remoteWrites).toBe(0);
    expect(state.commands.some((command) => command.kind === "write")).toBe(false);
  });

  it("apply constructs commands only against DRACO_DB nonprod", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = { commands: [] };
    const report = await runBootstrapSocialflowNonprodSourceData({
      mode: "apply",
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    const writeCommands = state.commands.filter((command) => command.kind === "write");
    expect(report.status).toBe("APPLY_OK");
    expect(writeCommands.length).toBeGreaterThan(0);
    expect(writeCommands.every((command) => command.databaseName === "drako_db_socialflow_canary")).toBe(true);
    expect(writeCommands.some((command) => command.databaseName.includes("prod"))).toBe(false);
  });

  it("excludes OAuth, tokens, and credentials", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = { commands: [] };
    const report = await runBootstrapSocialflowNonprodSourceData({
      mode: "apply",
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    const commandText = state.commands.map((command) => `${command.displayCommand}\n${command.sql}`).join("\n").toLowerCase();
    expect(report.oauthExcluded).toBe(true);
    expect(commandText).not.toContain("oauth");
    expect(commandText).not.toContain("credential");
    expect(commandText).not.toContain("access_token");
    expect(commandText).not.toContain("refresh_token");
  });

  it("blocks destructive SQL", () => {
    expect(() => assertSafeSocialflowNonprodSourceBootstrapSql("DROP TABLE saas;"))
      .toThrow("SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_SQL_NOT_ALLOWED");
    expect(() => assertSafeSocialflowNonprodSourceBootstrapSql("SELECT * FROM saas; DELETE FROM saas;"))
      .toThrow("SOCIALFLOW_NONPROD_SOURCE_BOOTSTRAP_SQL_FORBIDDEN");
  });

  it("verify-only validates canary rows", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runBootstrapSocialflowNonprodSourceData({
      mode: "verify-only",
      configPaths: [configPath],
      runner: createMockRunner({ commands: [], tables: seededTables() }),
    });

    expect(report.status).toBe("VERIFY_OK");
    expect(report.tables.saas.unchanged).toBe(1);
    expect(report.tables.tenants.unchanged).toBe(1);
  });

  it("is idempotent when all canary rows already match", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runBootstrapSocialflowNonprodSourceData({
      mode: "apply",
      configPaths: [configPath],
      runner: createMockRunner({ commands: [], tables: seededTables() }),
    });

    expect(report.idempotent).toBe(true);
    expect(report.remoteWrites).toBe(0);
  });

  it("reports inserts and unchanged correctly", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const missingReport = await runBootstrapSocialflowNonprodSourceData({
      mode: "dry-run",
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    });
    const unchangedReport = await runBootstrapSocialflowNonprodSourceData({
      mode: "verify-only",
      configPaths: [configPath],
      runner: createMockRunner({ commands: [], tables: seededTables() }),
    });

    expect(missingReport.tables.saas.inserts).toBe(1);
    expect(unchangedReport.tables.saas.unchanged).toBe(1);
  });
});
