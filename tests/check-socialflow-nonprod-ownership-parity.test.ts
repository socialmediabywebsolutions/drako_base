import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertReadOnlySocialflowNonprodParitySql,
  runCheckSocialflowNonprodOwnershipParity,
  type SocialflowNonprodParityRemoteCommand,
} from "../scripts/check-socialflow-nonprod-ownership-parity";

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
  commands: SocialflowNonprodParityRemoteCommand[];
  sourceTables?: Record<string, Record<string, unknown>[]>;
  targetTables?: Record<string, Record<string, unknown>[]>;
};

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-nonprod-parity-"));
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

function createMockRunner(state: MockRunnerState) {
  return (command: SocialflowNonprodParityRemoteCommand): string => {
    state.commands.push(command);
    const targetTables = state.targetTables ?? Object.fromEntries(TARGET_TABLES.map((table) => [table, []]));
    const sourceDb = command.databaseName === "drako_db_socialflow_canary";
    const tables = sourceDb ? state.sourceTables ?? {} : targetTables;

    const existsName = tableNameFromExistenceSql(command.sql);
    if (existsName) {
      return Object.prototype.hasOwnProperty.call(tables, existsName)
        ? jsonRows([{ name: existsName }])
        : jsonRows([]);
    }

    const selectName = tableNameFromSelectAllSql(command.sql);
    if (selectName) return jsonRows(tables[selectName] ?? []);
    return jsonRows([]);
  };
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

function matchingOwnershipTargetTables() {
  return {
    socialflow_seed_metadata: [{
      tenant_id: "tenant_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      slug: "socialflow",
      domain: "socialflow-canary.local",
      status: "active",
      metadata_json: JSON.stringify({
        source: "nonprod_core_backfill",
        name: "SocialFlow Canary SaaS",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    }],
    socialflow_export_read_models: [{
      tenant_id: "tenant_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      slug: "socialflow",
      status: "ready",
      dossier_json: JSON.stringify({
        id: "dossier_socialflow_canary",
        tenant_id: "tenant_socialflow_canary",
        status: "ready",
        version: 1,
        form_data: JSON.stringify({ objective: "canary validation", containsPersonalData: false }),
        analysis_data: JSON.stringify({ summary: "synthetic canary dossier" }),
        plan_data: JSON.stringify({ nextStep: "nonprod parity" }),
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
      blueprint_json: JSON.stringify({ source: "canary", product: "socialflow", synthetic: true }),
      work_logs_csv: "id,agent_name,action_type,status,cost_eur,created_at\nworklog_socialflow_canary,canary-agent,canary-bootstrap,completed,0,2026-01-01T00:00:00.000Z\n",
      orchestrator_messages_csv: "role,created_at,content\nsystem,2026-01-01T00:00:00.000Z,Synthetic SocialFlow canary source message.\n",
      financials_csv: "metric,value,unit\nmrr,0,EUR\ntotal_cost,0,EUR\nrisk_level,low,ENUM\nplan_tier,canary,ENUM\n",
      economic_events_csv: "id,type,severity,created_at,payload_json\nevent_socialflow_canary,canary,info,2026-01-01T00:00:00.000Z,\"{\"\"synthetic\"\":true,\"\"value\"\":0}\"\n",
      domains_json: JSON.stringify([{
        id: "domain_socialflow_canary",
        tenant_id: "tenant_socialflow_canary",
        saas_id: "saas_socialflow_canary",
        domain: "socialflow-canary.local",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }]),
      meta_json: JSON.stringify({
        saasId: "saas_socialflow_canary",
        tenantId: "tenant_socialflow_canary",
        generatedAt: "socialflow_nonprod_ownership_backfill",
        sourceRevision: "b485706eea65c6f88772627c",
      }),
      source_revision: "b485706eea65c6f88772627c",
    }],
    socialflow_legacy_strategic_dossiers: [{
      tenant_id: "tenant_socialflow_canary",
      dossier_id: "dossier_socialflow_canary",
      status: "ready",
      version: 1,
      form_data_json: JSON.stringify({ objective: "canary validation", containsPersonalData: false }),
      analysis_data_json: JSON.stringify({ summary: "synthetic canary dossier" }),
      plan_data_json: JSON.stringify({ nextStep: "nonprod parity" }),
      source_updated_at: "2026-01-01T00:00:00.000Z",
    }],
    socialflow_legacy_tenant_progress: [{
      tenant_id: "tenant_socialflow_canary",
      materialization_step: 1,
    }],
    socialflow_legacy_agent_work_logs: [{
      tenant_id: "tenant_socialflow_canary",
      log_id: "worklog_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      agent_name: "canary-agent",
      action_type: "canary-bootstrap",
      status: "completed",
      output_json: JSON.stringify({ synthetic: true, result: "ok" }),
      cost_eur: 0,
      created_at: "2026-01-01T00:00:00.000Z",
    }],
    socialflow_legacy_repository_context: [{
      tenant_id: "tenant_socialflow_canary",
      saas_id: "saas_socialflow_canary",
      slug: "socialflow",
      domain: "socialflow-canary.local",
      status: "active",
      metadata_json: JSON.stringify({
        source: "nonprod_core_backfill",
        coreSlug: "socialflow",
        sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
      }),
    }],
  };
}

describe("SocialFlow nonprod ownership parity", () => {
  it("rejects a DB with prod in the name", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace("saas_socialflows_canary_db", "saas_socialflows_prod_db"),
    );

    await expect(runCheckSocialflowNonprodOwnershipParity({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    })).rejects.toThrow("SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_DATABASE");
  });

  it("rejects switch ON", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace(
        'SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"',
        'SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"',
      ),
    );

    await expect(runCheckSocialflowNonprodOwnershipParity({
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

    await expect(runCheckSocialflowNonprodOwnershipParity({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    })).rejects.toThrow("SOCIALFLOW_NONPROD_PARITY_UNSAFE_STATUS");
  });

  it("blocks non-read SQL", () => {
    expect(() => assertReadOnlySocialflowNonprodParitySql("UPDATE socialflow_seed_metadata SET status = 'active';"))
      .toThrow("SOCIALFLOW_NONPROD_PARITY_SQL_NOT_READ_ONLY");
    expect(() => assertReadOnlySocialflowNonprodParitySql("SELECT * FROM socialflow_seed_metadata; DROP TABLE socialflow_seed_metadata;"))
      .toThrow("SOCIALFLOW_NONPROD_PARITY_SQL_WRITE_FORBIDDEN");
  });

  it("excludes OAuth always", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const state: MockRunnerState = { commands: [] };
    const report = await runCheckSocialflowNonprodOwnershipParity({
      allowEmptySource: true,
      configPaths: [configPath],
      runner: createMockRunner(state),
    });

    const commandText = state.commands.map((command) => `${command.displayCommand}\n${command.sql}`).join("\n").toLowerCase();
    expect(report.oauthExcluded).toBe(true);
    expect(report.skippedOAuth).toContain("socialflow_oauth_connections");
    expect(commandText).not.toContain("socialflow_oauth_connections");
    expect(commandText).not.toContain("drako_integration_credentials");
    expect(commandText).not.toContain("access_token");
  });

  it("detects empty source when not explicitly allowed", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runCheckSocialflowNonprodOwnershipParity({
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    });

    expect(report.status).toBe("EMPTY_SOURCE_REJECTED");
    expect(report.exitCode).toBe(3);
    expect(report.ok).toBe(false);
  });

  it("accepts empty source only with --allow-empty-source", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runCheckSocialflowNonprodOwnershipParity({
      allowEmptySource: true,
      configPaths: [configPath],
      runner: createMockRunner({ commands: [] }),
    });

    expect(report.status).toBe("EMPTY_SOURCE_ACCEPTED");
    expect(report.exitCode).toBe(0);
    expect(report.warnings).toContain("SOCIALFLOW_NONPROD_OWNERSHIP_PARITY_EMPTY_SOURCE_ACCEPTED");
  });

  it("passes strict parity with non-empty canary source once SOCIAL_DB contains matching ownership rows", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runCheckSocialflowNonprodOwnershipParity({
      configPaths: [configPath],
      runner: createMockRunner({
        commands: [],
        sourceTables: seededOwnershipSourceTables(),
        targetTables: matchingOwnershipTargetTables(),
      }),
    });

    expect(report.status).toBe("PARITY_OK");
    expect(report.exitCode).toBe(0);
    expect(report.ok).toBe(true);
    expect(report.totals.matched).toBe(6);
    expect(report.totals.missingInSocial).toBe(0);
    expect(report.totals.missingInCore).toBe(0);
    expect(report.totals.mismatched).toBe(0);
    expect(report.totals.emptySources).toBe(0);
  });

  it("detects drift when source has a SocialFlow seed missing in SOCIAL_DB", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runCheckSocialflowNonprodOwnershipParity({
      configPaths: [configPath],
      runner: createMockRunner({
        commands: [],
        sourceTables: {
          saas: [{ id: "socialflow", tenant_id: "tenant_1", slug: "socialflow", status: "active" }],
        },
      }),
    });

    expect(report.status).toBe("DRIFT_DETECTED");
    expect(report.exitCode).toBe(2);
    expect(report.totals.missingInSocial).toBeGreaterThan(0);
  });

  it("--allow-drift does not fail with drift", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runCheckSocialflowNonprodOwnershipParity({
      allowDrift: true,
      configPaths: [configPath],
      runner: createMockRunner({
        commands: [],
        sourceTables: {
          saas: [{ id: "socialflow", tenant_id: "tenant_1", slug: "socialflow", status: "active" }],
        },
      }),
    });

    expect(report.status).toBe("DRIFT_ALLOWED");
    expect(report.exitCode).toBe(0);
  });

  it("reports matched, missing, and mismatched details", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const report = await runCheckSocialflowNonprodOwnershipParity({
      allowDrift: true,
      configPaths: [configPath],
      runner: createMockRunner({
        commands: [],
        sourceTables: {
          saas: [
            { id: "socialflow", tenant_id: "tenant_1", slug: "socialflow", status: "active" },
            { id: "socialflow", tenant_id: "tenant_2", slug: "socialflow", status: "active" },
          ],
        },
        targetTables: {
          socialflow_seed_metadata: [
            {
              tenant_id: "tenant_1",
              saas_id: "socialflow",
              slug: "socialflow",
              domain: "",
              status: "active",
              metadata_json: JSON.stringify({ source: "nonprod_core_backfill", name: null, createdAt: null }),
            },
            {
              tenant_id: "tenant_2",
              saas_id: "socialflow",
              slug: "socialflow",
              domain: "",
              status: "inactive",
              metadata_json: JSON.stringify({ source: "nonprod_core_backfill", name: null, createdAt: null }),
            },
            {
              tenant_id: "tenant_orphan",
              saas_id: "socialflow",
              slug: "socialflow",
              domain: "",
              status: "active",
              metadata_json: "{}",
            },
          ],
          socialflow_export_read_models: [],
          socialflow_legacy_strategic_dossiers: [],
          socialflow_legacy_tenant_progress: [],
          socialflow_legacy_agent_work_logs: [],
          socialflow_legacy_repository_context: [],
        },
      }),
    });

    expect(report.groups.runtimeSeed.matched).toBe(1);
    expect(report.groups.runtimeSeed.mismatched).toHaveLength(1);
    expect(report.groups.runtimeSeed.missingInCore).toHaveLength(1);
  });
});
