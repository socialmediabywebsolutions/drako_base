import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createSocialflowNonprodOwnershipMigrationPlan,
  executeSocialflowNonprodOwnershipMigrations,
  SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS,
  type SocialflowNonprodOwnershipRemoteCommand,
} from "../scripts/apply-socialflow-nonprod-ownership-migrations";

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

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-nonprod-migrations-"));
  const configPath = path.join(tmpDir, "wrangler.toml");
  await fs.writeFile(configPath, source, "utf8");
  return configPath;
}

function tableListOutput(): string {
  return SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS
    .flatMap((migration) => migration.tables)
    .join("\n");
}

describe("SocialFlow nonprod ownership migration script", () => {
  it("rejects a SOCIAL_DB with a productive database name", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace("saas_socialflows_canary_db", "saas_socialflows_prod_db"),
    );

    expect(() => createSocialflowNonprodOwnershipMigrationPlan({ configPaths: [configPath] })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_DATABASE",
    );
  });

  it("rejects placeholder D1 ids", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace("349fa685-044e-4292-b6e9-b1cafd35896e", "00000000-0000-4000-8000-000000000188"),
    );

    expect(() => createSocialflowNonprodOwnershipMigrationPlan({ configPaths: [configPath] })).toThrow(
      "SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_UNSAFE_STATUS",
    );
  });

  it("rejects a switch ON by default", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace(
        'SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"',
        'SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"',
      ),
    );

    expect(() => createSocialflowNonprodOwnershipMigrationPlan({ configPaths: [configPath] })).toThrow(
      "SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS_SWITCH_NOT_OFF",
    );
  });

  it("rejects deployable=true even with real nonprod D1 ids", async () => {
    const configPath = await writeTempConfig(
      REAL_NONPROD_CONFIG.replace(
        'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"',
        'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"\nSOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"',
      ),
    );

    expect(() => createSocialflowNonprodOwnershipMigrationPlan({ configPaths: [configPath] })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_DEPLOYABLE_REQUIRES_RUNTIME_SEED_ON",
    );
  });

  it("dry-run does not execute remote commands", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const plan = createSocialflowNonprodOwnershipMigrationPlan({ configPaths: [configPath], mode: "dry-run" });
    const result = executeSocialflowNonprodOwnershipMigrations(plan, () => {
      throw new Error("remote should not run");
    });

    expect(result.status).toBe("DRY_RUN");
    expect(result.applyCommands).toHaveLength(4);
    expect(result.verifyCommands.length).toBeGreaterThan(4);
  });

  it("verify-only validates expected table presence", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const plan = createSocialflowNonprodOwnershipMigrationPlan({ configPaths: [configPath], mode: "verify-only" });
    const result = executeSocialflowNonprodOwnershipMigrations(plan, (command) => {
      if (command.kind === "list-tables") {
        return tableListOutput();
      }

      return "cid name type notnull dflt_value pk\n0 id TEXT 0 NULL 1";
    });

    expect(result.status).toBe("VERIFY_OK");
    expect(result.verifiedTables).toContain("socialflow_seed_metadata");
    expect(result.verifiedTables).toContain("socialflow_legacy_repository_context");
  });

  it("apply builds remote commands only for SOCIAL_DB nonprod", async () => {
    const configPath = await writeTempConfig(REAL_NONPROD_CONFIG);
    const plan = createSocialflowNonprodOwnershipMigrationPlan({ configPaths: [configPath], mode: "apply" });
    const commands: SocialflowNonprodOwnershipRemoteCommand[] = [];
    const result = executeSocialflowNonprodOwnershipMigrations(plan, (command) => {
      commands.push(command);
      if (command.kind === "list-tables") {
        return tableListOutput();
      }

      return "cid name type notnull dflt_value pk\n0 id TEXT 0 NULL 1";
    });

    expect(result.status).toBe("APPLY_OK");
    expect(commands.every((command) => command.databaseName === "saas_socialflows_canary_db")).toBe(true);
    expect(commands.some((command) => command.databaseName.includes("prod"))).toBe(false);
    expect(commands.filter((command) => command.kind === "apply-migration").map((command) => command.migrationId)).toEqual([
      "0187",
      "0188",
      "0189",
      "0190",
    ]);
  });

  it("maps migrations 0187 through 0190 to the expected files", () => {
    expect(SOCIALFLOW_NONPROD_OWNERSHIP_MIGRATIONS.map((migration) => [migration.id, migration.file])).toEqual([
      ["0187", "migrations/0187_socialflow_seed_metadata.sql"],
      ["0188", "migrations/0188_socialflow_export_read_models.sql"],
      ["0189", "migrations/0189_socialflow_oauth_connections.sql"],
      ["0190", "migrations/0190_socialflow_legacy_read_models.sql"],
    ]);
  });
});
