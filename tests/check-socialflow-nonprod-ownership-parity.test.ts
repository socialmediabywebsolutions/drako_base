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
