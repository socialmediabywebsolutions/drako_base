import { describe, expect, it } from "vitest";
import { runAuditSocialflowFinalSeparationCutover } from "../scripts/audit-socialflow-final-separation-cutover";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH = `
name = "saas-socialflows-runtime-canary-nonprod"

[vars]
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "1"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
`;

const MOCK_CONFIG_ALL_SWITCHES_OFF = `
name = "saas-socialflows-runtime-canary-nonprod"

[vars]
SOCIALFLOW_RUNTIME_SEED_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_EXPORT_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LEGACY_READ_MODELS_SOCIAL_DB_READ_SWITCH = "0"
SOCIALFLOW_LINKEDIN_OAUTH_SOCIAL_DB_READ_SWITCH = "0"
`;

async function writeTempConfig(source: string): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-socialflow-audit-"));
  const configPath = path.join(tmpDir, "wrangler.toml");
  await fs.writeFile(configPath, source, "utf8");
  return configPath;
}

describe("socialflow final separation cutover audit", () => {
  it("detects runtime seed ON", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    const runtimeSeedSwitch = audit.switches.find((s) => s.name.includes("RUNTIME_SEED"));
    expect(runtimeSeedSwitch?.status).toBe("ON");
    expect(runtimeSeedSwitch?.value).toBe("1");
  });

  it("detects exports ON", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    const exportsSwitch = audit.switches.find((s) => s.name.includes("EXPORT"));
    expect(exportsSwitch?.status).toBe("ON");
    expect(exportsSwitch?.value).toBe("1");
  });

  it("detects legacy ON", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    const legacySwitch = audit.switches.find((s) => s.name.includes("LEGACY"));
    expect(legacySwitch?.status).toBe("ON");
    expect(legacySwitch?.value).toBe("1");
  });

  it("detects OAuth OFF", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    const oauthSwitch = audit.switches.find((s) => s.name.includes("OAUTH"));
    expect(oauthSwitch?.status).toBe("OFF");
    expect(oauthSwitch?.value).toBe("0");
  });

  it("detects OAuth as last switch pending", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    const oauthModule = audit.modules.find((m) => m.name === "OAuth");
    expect(oauthModule?.status).toBe("NEEDS_OAUTH_SWITCH");
  });

  it("detects runtime/exports/legacy as SOCIAL_DB-first", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    const runtimeSeedModule = audit.modules.find((m) => m.name === "Runtime Seed");
    const exportsModule = audit.modules.find((m) => m.name === "Exports");
    const legacyModule = audit.modules.find((m) => m.name === "Legacy Read Models");

    expect(runtimeSeedModule?.status).toBe("READY");
    expect(runtimeSeedModule?.dbCurrent).toBe("SOCIAL_DB");

    expect(exportsModule?.status).toBe("READY");
    expect(exportsModule?.dbCurrent).toBe("SOCIAL_DB");

    expect(legacyModule?.status).toBe("READY");
    expect(legacyModule?.dbCurrent).toBe("SOCIAL_DB");
  });

  it("reports fallback DRACO_DB as transitional", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    expect(audit.coreBackedResidues.some((r) => r.includes("fallback"))).toBe(true);
    expect(audit.coreBackedResidues.some((r) => r.includes("TRANSITIONAL_ACCEPTED"))).toBe(true);
  });

  it("reports allowed contracts", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    expect(audit.imports.allowlisted.length).toBeGreaterThan(0);
    expect(audit.imports.violations.length).toBe(0);
  });

  it("generates valid JSON", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath, json: true });

    const jsonString = JSON.stringify(audit);
    expect(() => JSON.parse(jsonString)).not.toThrow();
    expect(audit).toHaveProperty("ok");
    expect(audit).toHaveProperty("status");
    expect(audit).toHaveProperty("switches");
    expect(audit).toHaveProperty("modules");
    expect(audit).toHaveProperty("blockers");
  });

  it("generates valid markdown", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath, markdown: true });

    expect(audit.status).toBe("SOCIALFLOW_FINAL_SEPARATION_AUDIT_OK");
  });

  it("reports blockers before OAuth ON when switches are off", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_OFF);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    expect(audit.blockers.beforeOAuthOn.length).toBeGreaterThan(0);
    expect(audit.blockers.beforeOAuthOn.some((b) => b.includes("MUST_BE_ON"))).toBe(true);
  });

  it("reports no blockers before OAuth ON when all other switches are ON", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    expect(audit.blockers.beforeOAuthOn.length).toBe(0);
  });

  it("reports OAuth activation as blocker before deploy independent", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    expect(audit.blockers.beforeDeployIndependent.some((b) => b.includes("OAUTH"))).toBe(true);
  });

  it("confirms token safety and authMeta safety", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    expect(audit.risks.tokenSafety).toBe("SAFE");
    expect(audit.risks.authMetaSafety).toBe("SAFE");
  });

  it("calculates summary correctly", async () => {
    const configPath = await writeTempConfig(MOCK_CONFIG_ALL_SWITCHES_ON_EXCEPT_OAUTH);

    const audit = await runAuditSocialflowFinalSeparationCutover({ configPath });

    expect(audit.summary.totalModules).toBeGreaterThan(0);
    expect(audit.summary.socialDbFirst).toBeGreaterThan(0);
    expect(audit.summary.pendingOAuth).toBeGreaterThan(0);
  });
});
