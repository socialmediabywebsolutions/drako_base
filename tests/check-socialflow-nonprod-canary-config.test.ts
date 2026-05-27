import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { checkSocialflowNonprodCanaryConfig } from "../scripts/check-socialflow-nonprod-canary-config";

const VALID_NONPROD_CONFIG = `
name = "saas-socialflows-runtime-canary-nonprod"

[[d1_databases]]
binding = "DRACO_DB"
database_name = "drako_db_socialflow_canary_nonprod"
database_id = "00000000-0000-4000-8000-000000000187"

[[d1_databases]]
binding = "SAASES_DB"
database_name = "saas_socialflows_canary_nonprod_db"
database_id = "00000000-0000-4000-8000-000000000188"

[[d1_databases]]
binding = "SOCIAL_DB"
database_name = "saas_socialflows_canary_nonprod_db"
database_id = "00000000-0000-4000-8000-000000000188"

[[d1_databases]]
binding = "SOCIALFLOW_AUTHS_DB"
database_name = "saas_socialflow_auths_canary_nonprod_db"
database_id = "00000000-0000-4000-8000-000000000189"

[vars]
SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"
SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
`;

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-canary-config-"));
  const configPath = path.join(tmpDir, "wrangler.toml");
  await fs.writeFile(configPath, source, "utf8");
  return configPath;
}

describe("socialflow nonprod canary config guard", () => {
  it("accepts a nonprod placeholder config with all switches off", async () => {
    const configPath = await writeTempConfig(VALID_NONPROD_CONFIG);
    const report = checkSocialflowNonprodCanaryConfig({ configPath });

    expect(report.workerName).toBe("saas-socialflows-runtime-canary-nonprod");
    expect(report.placeholders).toEqual(["DRACO_DB", "SAASES_DB", "SOCIAL_DB", "SOCIALFLOW_AUTHS_DB"]);
    expect(report.deployable).toBe(false);
    expect(report.allowDeployWithRealD1).toBe(false);
    expect(report.status).toBe("NON_DEPLOYABLE_PLACEHOLDER_CONFIG");
  });

  it("accepts real nonprod ids when names are isolated and switches are off", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG
        .replace("00000000-0000-4000-8000-000000000187", "11111111-1111-4111-8111-111111111187")
        .replaceAll("00000000-0000-4000-8000-000000000188", "22222222-2222-4222-8222-222222222188")
        .replace("00000000-0000-4000-8000-000000000189", "33333333-3333-4333-8333-333333333189"),
    );

    const report = checkSocialflowNonprodCanaryConfig({ configPath });
    expect(report.placeholders).toEqual([]);
    expect(report.status).toBe("NON_DEPLOYABLE_REAL_NONPROD_CONFIG");
  });

  it("accepts real nonprod ids with only runtime seed read switch on", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG
        .replace("00000000-0000-4000-8000-000000000187", "11111111-1111-4111-8111-111111111187")
        .replaceAll("00000000-0000-4000-8000-000000000188", "22222222-2222-4222-8222-222222222188")
        .replace("00000000-0000-4000-8000-000000000189", "33333333-3333-4333-8333-333333333189")
        .replace('SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"'),
    );

    const report = checkSocialflowNonprodCanaryConfig({ configPath });
    expect(report.switches.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.switches.SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH).toBe("0");
    expect(report.switches.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH).toBe("0");
    expect(report.switches.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH).toBe("0");
    expect(report.status).toBe("NON_DEPLOYABLE_REAL_NONPROD_CONFIG");
  });

  it("accepts deployable real nonprod ids only with explicit future allow-deploy flag", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG
        .replace("00000000-0000-4000-8000-000000000187", "11111111-1111-4111-8111-111111111187")
        .replaceAll("00000000-0000-4000-8000-000000000188", "22222222-2222-4222-8222-222222222188")
        .replace("00000000-0000-4000-8000-000000000189", "33333333-3333-4333-8333-333333333189")
        .replace('SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"', 'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"\nSOCIALFLOW_NONPROD_CANARY_ALLOW_DEPLOY_WITH_REAL_D1 = "true"'),
    );

    const report = checkSocialflowNonprodCanaryConfig({ configPath });
    expect(report.deployable).toBe(true);
    expect(report.allowDeployWithRealD1).toBe(true);
    expect(report.status).toBe("DEPLOYABLE_REAL_NONPROD_CONFIG");
  });

  it("rejects productive database names", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG.replace("drako_db_socialflow_canary_nonprod", "drako_db_prod"),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_DATABASE",
    );
  });

  it("rejects known productive database ids", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG.replace("00000000-0000-4000-8000-000000000187", "5607a76a-97c7-45a9-a948-e545ba27eae7"),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_PRODUCTIVE_DATABASE_ID",
    );
  });

  it("accepts runtime seed + exports + legacy ON with OAuth OFF", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG
        .replace("00000000-0000-4000-8000-000000000187", "11111111-1111-4111-8111-111111111187")
        .replaceAll("00000000-0000-4000-8000-000000000188", "22222222-2222-4222-8222-222222222188")
        .replace("00000000-0000-4000-8000-000000000189", "33333333-3333-4333-8333-333333333189")
        .replace('SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"')
        .replace('SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"')
        .replace('SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"'),
    );

    const report = checkSocialflowNonprodCanaryConfig({ configPath });
    expect(report.switches.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.switches.SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.switches.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.switches.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH).toBe("0");
    expect(report.status).toBe("NON_DEPLOYABLE_REAL_NONPROD_CONFIG");
  });

  it("accepts all 4 switches ON with deployable false", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG
        .replace("00000000-0000-4000-8000-000000000187", "11111111-1111-4111-8111-111111111187")
        .replaceAll("00000000-0000-4000-8000-000000000188", "22222222-2222-4222-8222-222222222188")
        .replace("00000000-0000-4000-8000-000000000189", "33333333-3333-4333-8333-333333333189")
        .replace('SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"')
        .replace('SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"')
        .replace('SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"')
        .replace('SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "1"'),
    );

    const report = checkSocialflowNonprodCanaryConfig({ configPath });
    expect(report.switches.SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.switches.SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.switches.SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.switches.SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH).toBe("1");
    expect(report.deployable).toBe(false);
    expect(report.status).toBe("NON_DEPLOYABLE_REAL_NONPROD_CONFIG");
  });

  it("rejects invalid runtime seed switch values", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG.replace('SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"', 'SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "yes"'),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_RUNTIME_SEED_SWITCH_INVALID",
    );
  });

  it("rejects missing required bindings", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG.replace(`[[d1_databases]]
binding = "SOCIALFLOW_AUTHS_DB"
database_name = "saas_socialflow_auths_canary_nonprod_db"
database_id = "00000000-0000-4000-8000-000000000189"
`, ""),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_BINDING_MISSING:SOCIALFLOW_AUTHS_DB",
    );
  });

  it("rejects placeholder config marked deployable", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG.replace('SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"', 'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"'),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_PLACEHOLDER_DEPLOYABLE",
    );
  });

  it("rejects real nonprod deployable config without explicit future allow-deploy flag", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG
        .replace("00000000-0000-4000-8000-000000000187", "11111111-1111-4111-8111-111111111187")
        .replaceAll("00000000-0000-4000-8000-000000000188", "22222222-2222-4222-8222-222222222188")
        .replace("00000000-0000-4000-8000-000000000189", "33333333-3333-4333-8333-333333333189")
        .replace('SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "false"', 'SOCIALFLOW_NONPROD_CANARY_DEPLOYABLE = "true"'),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_DEPLOYABLE_NOT_ALLOWED",
    );
  });

  it("rejects missing rollback state", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG.replace('SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"\n', ""),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_ROLLBACK_STATE_MISSING",
    );
  });

  it("rejects rollback state different from all-switches-off", async () => {
    const configPath = await writeTempConfig(
      VALID_NONPROD_CONFIG.replace(
        'SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "all-switches-off"',
        'SOCIALFLOW_CANARY_ROLLBACK_SWITCH_STATE = "runtime-seed-on"',
      ),
    );

    expect(() => checkSocialflowNonprodCanaryConfig({ configPath })).toThrow(
      "SOCIALFLOW_NONPROD_CANARY_CONFIG_ROLLBACK_STATE_MISSING",
    );
  });
});
