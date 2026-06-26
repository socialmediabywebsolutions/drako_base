import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  runBackfillSocialflowNonprodOwnershipReadModels,
  type SocialflowNonprodBackfillRemoteCommand,
} from "../scripts/backfill-socialflow-nonprod-ownership-read-models";

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

const TARGET_TABLES = [
  "socialflow_seed_metadata",
  "socialflow_export_read_models",
  "socialflow_legacy_strategic_dossiers",
  "socialflow_legacy_tenant_progress",
  "socialflow_legacy_agent_work_logs",
  "socialflow_legacy_repository_context",
] as const;

type MockRunnerState = {
  commands: SocialflowNonprodBackfillRemoteCommand[];
  sourceTables?: Record<string, Record<string, unknown>[]>;
  targetTables?: Record<string, Record<string, unknown>[]>;
};

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-nonprod-backfill-"));
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

function tableNameFromSelectAllSql(sql: string): string | null {
  const match = sql.match(/^SELECT \* FROM ([a-zA-Z0-9_]+);$/);
  return match?.[1] ?? null;
}

function tableNameFromCountSql(sql: string): string | null {
  const match = sql.match(/^SELECT COUNT\(\*\) AS count FROM ([a-zA-Z0-9_]+);$/);
  return match?.[1] ?? null;
}

function splitSqlList(sql: string): string[] {
  const values: string[] = [];
  let current = "";
  let inString = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "'") {
      current += char;
      if (inString && next === "'") {
        current += next;
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (char === "," && !inString) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

function parseSqlValue(token: string): unknown {
  const trimmed = token.trim();
  if (/^null$/i.test(trimmed)) return null;
  if (/^datetime\('now'\)$/i.test(trimmed)) return "now";
  if (/^-?\d+(?:\.\d+)?$/i.test(trimmed)) return Number(trimmed);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed;
}

function parseInsertSql(sql: string): { table: string; row: Record<string, unknown> } | null {
  const match = sql.match(/INSERT INTO\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)\s*ON CONFLICT/i);
  if (!match) return null;

  const [, table, rawColumns, rawValues] = match;
  const columns = splitSqlList(rawColumns);
  const values = splitSqlList(rawValues);
  if (columns.length !== values.length) {
    throw new Error(`TEST_SQL_PARSE_MISMATCH:${table}:${columns.length}:${values.length}`);
  }

  const row: Record<string, unknown> = {};
  for (let index = 0; index < columns.length; index += 1) {
    row[columns[index]] = parseSqlValue(values[index]);
  }

  return { table, row };
}

function upsertTargetRow(
  table: string,
  row: Record<string, unknown>,
  targetTables: Record<string, Record<string, unknown>[]>,
): void {
  const keyFieldsByTable: Record<string, string[]> = {
    socialflow_seed_metadata: ["tenant_id", "saas_id", "slug"],
    socialflow_export_read_models: ["tenant_id", "saas_id"],
    socialflow_legacy_strategic_dossiers: ["tenant_id", "dossier_id"],
    socialflow_legacy_tenant_progress: ["tenant_id"],
    socialflow_legacy_agent_work_logs: ["tenant_id", "log_id"],
    socialflow_legacy_repository_context: ["tenant_id", "saas_id"],
  };
  const keyFields = keyFieldsByTable[table];
  if (!keyFields) {
    throw new Error(`TEST_TARGET_TABLE_KEY_MISSING:${table}`);
  }

  const key = keyFields.map((field) => String(row[field] ?? "")).join("::");
  const rows = targetTables[table] ?? [];
  const existingIndex = rows.findIndex((candidate) =>
    keyFields.every((field) => String(candidate[field] ?? "") === String(row[field] ?? "")));

  if (existingIndex >= 0) {
    rows[existingIndex] = { ...rows[existingIndex], ...row };
  } else {
    rows.push(row);
  }

  targetTables[table] = rows;
}

function seededOwnershipSourceTables() {
  return {
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
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    tenant_strategic_dossiers: [{
      id: "dossier_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      status: "ready",
      version: 1,
      form_data: JSON.stringify({ objective: "canary validation", containsPersonalData: false }),
      analysis_data: JSON.stringify({ summary: "synthetic canary dossier" }),
      plan_data: JSON.stringify({ nextStep: "nonprod parity" }),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
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
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    tenants: [{
      tenant_id: "tenant_socialflow_canary",
      materialization_step: 1,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    saas_domains: [{
      id: "domain_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      domain: "socialflow-canary.local",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    }],
    orchestrator_messages: [{
      id: "message_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      role: "system",
      content: "Synthetic SocialFlow canary source message.",
      created_at: "2026-01-01T00:00:00.000Z",
    }],
    economic_events: [{
      id: "event_socialflow_canary",
      tenant_id: "tenant_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      type: "canary",
      severity: "info",
      payload_json: JSON.stringify({ synthetic: true, value: 0 }),
      created_at: "2026-01-01T00:00:00.000Z",
    }],
  };
}

function createMockRunner(state: MockRunnerState) {
  return (command: SocialflowNonprodBackfillRemoteCommand): string => {
    state.commands.push(command);
    const sourceTables = state.sourceTables ?? {};
    const targetTables = state.targetTables ?? Object.fromEntries(TARGET_TABLES.map((table) => [table, []]));
    state.targetTables = targetTables;
    const sourceDb = command.databaseName === "drako_db_socialflow_canary";
    const tables = sourceDb ? sourceTables : targetTables;
    const existsName = tableNameFromExistenceSql(command.sql);
    if (existsName) {
      return Object.prototype.hasOwnProperty.call(tables, existsName)
        ? jsonRows([{ name: existsName }])
        : jsonRows([]);
    }

    const selectName = tableNameFromSelectAllSql(command.sql);
    if (selectName) {
      return jsonRows(tables[selectName] ?? []);
    }

    const countName = tableNameFromCountSql(command.sql);
    if (countName) {
      return jsonRows([{ count: tables[countName]?.length ?? 0 }]);
    }

    if (command.kind === "write") {
      const parsed = parseInsertSql(command.sql);
      if (parsed) {
        upsertTargetRow(parsed.table, parsed.row, targetTables);
      }
      return jsonRows([]);
    }

    return jsonRows([]);
  };
}

describe("SocialFlow nonprod ownership read-model backfill", () => {
  it("rejects a DB with prod in the name", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace("saas_socialflows_canary_db", "saas_socialflows_prod_db"),
    );

    await expect(runBackfillSocialflowNonprodOwnershipReadModels({
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

    await expect(runBackfillSocialflowNonprodOwnershipReadModels({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    })).rejects.toThrow("SOCIALFLOW_NONPROD_BACKFILL_SWITCH_NOT_OFF");
  });

  it("rejects deployable=true", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace(
        'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"',
        'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"\nSOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"',
      ),
    );

    await expect(runBackfillSocialflowNonprodOwnershipReadModels({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    })).rejects.toThrow("SOCIALFLOW_NONPROD_CANARY_CONFIG_DEPLOYABLE_REQUIRES_RUNTIME_SEED_ON");
  });

  it("dry-run reads but does not write", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = {
      commands: [],
      sourceTables: {
        saas: [
          {
            id: "saas_social",
            tenant_id: "tenant_1",
            slug: "socialflow",
            name: "SocialFlow",
            status: "active",
          },
        ],
      },
    };

    const report = await runBackfillSocialflowNonprodOwnershipReadModels({
      mode: "dry-run",
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    expect(report.status).toBe("DRY_RUN_OK");
    expect(report.remoteWrites).toBe(0);
    expect(state.commands.some((command) => command.kind === "write")).toBe(false);
    expect(report.tables.runtimeSeed.inserts).toBe(1);
  });

  it("apply constructs writes only against nonprod SOCIAL_DB", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = {
      commands: [],
      sourceTables: {
        saas: [
          {
            id: "saas_social",
            tenant_id: "tenant_1",
            slug: "socialflow",
            name: "SocialFlow",
            status: "active",
          },
        ],
      },
    };

    const report = await runBackfillSocialflowNonprodOwnershipReadModels({
      mode: "apply",
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    const writeCommands = state.commands.filter((command) => command.kind === "write");
    expect(report.status).toBe("APPLY_OK");
    expect(writeCommands.length).toBeGreaterThan(0);
    expect(writeCommands.every((command) => command.databaseName === "saas_socialflows_canary_db")).toBe(true);
    expect(writeCommands.some((command) => command.databaseName.includes("prod"))).toBe(false);
  });

  it("apply with non-empty source materializes all six ownership read models and becomes idempotent", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = {
      commands: [],
      sourceTables: seededOwnershipSourceTables(),
    };

    const report = await runBackfillSocialflowNonprodOwnershipReadModels({
      mode: "apply",
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    expect(report.status).toBe("APPLY_OK");
    expect(report.remoteWrites).toBe(6);
    expect(report.idempotent).toBe(true);
    expect(report.targetCounts.socialflow_seed_metadata).toBe(1);
    expect(report.targetCounts.socialflow_export_read_models).toBe(1);
    expect(report.targetCounts.socialflow_legacy_strategic_dossiers).toBe(1);
    expect(report.targetCounts.socialflow_legacy_tenant_progress).toBe(1);
    expect(report.targetCounts.socialflow_legacy_agent_work_logs).toBe(1);
    expect(report.targetCounts.socialflow_legacy_repository_context).toBe(1);
    expect(report.tables.runtimeSeed.unchanged).toBe(1);
    expect(report.tables.exports.unchanged).toBe(1);
    expect(report.tables.legacyDossiers.unchanged).toBe(1);
    expect(report.tables.legacyProgress.unchanged).toBe(1);
    expect(report.tables.legacyWorkLogs.unchanged).toBe(1);
    expect(report.tables.legacyRepositoryContext.unchanged).toBe(1);
  });

  it("excludes OAuth tables and credentials from every command", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = { commands: [] };

    const report = await runBackfillSocialflowNonprodOwnershipReadModels({
      mode: "verify-only",
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    const commandText = state.commands.map((command) => `${command.displayCommand}\n${command.sql}`).join("\n").toLowerCase();
    expect(report.oauthExcluded).toBe(true);
    expect(commandText).not.toContain("socialflow_oauth_connections");
    expect(commandText).not.toContain("drako_integration_credentials");
    expect(commandText).not.toContain("encrypted_access_token");
  });

  it("verify-only validates target counts", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runBackfillSocialflowNonprodOwnershipReadModels({
      mode: "verify-only",
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    });

    expect(report.status).toBe("VERIFY_OK");
    expect(report.targetCounts.socialflow_seed_metadata).toBe(0);
    expect(report.targetCounts.socialflow_legacy_repository_context).toBe(0);
  });

  it("is idempotent when nonprod source is empty", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runBackfillSocialflowNonprodOwnershipReadModels({
      mode: "apply",
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    });

    expect(report.idempotent).toBe(true);
    expect(report.remoteWrites).toBe(0);
  });

  it("reports zero rows with warnings when nonprod source tables are absent", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runBackfillSocialflowNonprodOwnershipReadModels({
      mode: "verify-only",
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    });

    expect(report.tables.runtimeSeed.sourceRows).toBe(0);
    expect(report.warnings.some((warning) => warning.startsWith("SOURCE_TABLE_MISSING:"))).toBe(true);
    expect(report.warnings).toContain("NONPROD_SOURCE_EMPTY_OR_NOT_BOOTSTRAPPED:no source rows found in DRACO_DB canary");
  });
});
