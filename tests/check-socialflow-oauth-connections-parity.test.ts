import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowOAuthConnections } from "../scripts/backfill-socialflow-oauth-connections";
import {
  runCheckSocialflowOAuthConnectionsParity,
  runCheckSocialflowOAuthConnectionsParityCli,
} from "../scripts/check-socialflow-oauth-connections-parity";

type FixtureSchema = {
  bindings: {
    draco: boolean;
    social: boolean;
  };
  draco: {
    tables: string[];
  };
  social: {
    tables: string[];
  };
  env?: {
    socialflowTokenEncryptionSecret?: string;
  };
};

type FixtureSource = {
  connections: Array<Record<string, unknown>>;
  credentials: Array<Record<string, unknown>>;
};

type FixtureTarget = Array<Record<string, unknown>>;

const BASE_SCHEMA: FixtureSchema = {
  bindings: {
    draco: true,
    social: true,
  },
  draco: {
    tables: [
      "drako_integration_connections",
      "drako_integration_credentials",
    ],
  },
  social: {
    tables: ["socialflow_oauth_connections"],
  },
  env: {
    socialflowTokenEncryptionSecret: "local-socialflow-oauth-parity-secret-1234567890",
  },
};

const BASE_SOURCE: FixtureSource = {
  connections: [
    {
      connection_id: "conn_linkedin_alpha",
      tenant_id: "tenant_alpha",
      saas_id: "saas_alpha",
      integration_key: "linkedin",
      connection_label: "Alpha LinkedIn",
      status: "CONNECTED",
      metadata_json: JSON.stringify({
        provider: "LINKEDIN",
        mode: "live",
        profileId: "member_alpha",
        authorUrn: "urn:li:person:member_alpha",
        displayName: "Alpha User",
        email: "alpha@example.com",
      }),
      last_validated_at: "2026-05-24T00:00:00.000Z",
      last_error_code: null,
      last_error_message: null,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    },
    {
      connection_id: "conn_stripe_ignored",
      tenant_id: "tenant_alpha",
      saas_id: "saas_alpha",
      integration_key: "stripe",
      connection_label: "Alpha Stripe",
      status: "CONNECTED",
      metadata_json: "{}",
      last_validated_at: "2026-05-24T00:00:00.000Z",
      last_error_code: null,
      last_error_message: null,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    },
  ],
  credentials: [
    {
      connection_id: "conn_linkedin_alpha",
      payload_json: JSON.stringify({
        accessToken: "plain-access-token-alpha",
        refreshToken: "plain-refresh-token-alpha",
        idToken: "plain-id-token-alpha",
        scope: "openid profile email w_member_social",
        tokenType: "Bearer",
        expiresIn: 3600,
        profileId: "member_alpha",
        authorUrn: "urn:li:person:member_alpha",
      }),
    },
    {
      connection_id: "conn_stripe_ignored",
      payload_json: JSON.stringify({
        apiKey: "ignored",
      }),
    },
  ],
};

async function writeFixtures(
  fixturesDir: string,
  schema: FixtureSchema,
  source: FixtureSource,
  target: FixtureTarget = [],
) {
  await fs.mkdir(fixturesDir, { recursive: true });
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-oauth-backfill-schema.json"),
    `${JSON.stringify(schema, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-oauth-core-source.json"),
    `${JSON.stringify(source, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(fixturesDir, "socialflow-oauth-connections.json"),
    `${JSON.stringify(target, null, 2)}\n`,
    "utf8",
  );
}

describe("socialflow oauth connections parity", () => {
  it("returns exit 0 when there is no drift in fixtures mode", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-parity-ok-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    await runBackfillSocialflowOAuthConnections({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const report = await runCheckSocialflowOAuthConnectionsParity({
      fixturesDir,
      log: () => {},
    });
    const code = await runCheckSocialflowOAuthConnectionsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );

    expect(report.mode).toBe("fixtures");
    expect(report.matched).toBe(1);
    expect(report.missingInSocial).toHaveLength(0);
    expect(report.missingInCore).toHaveLength(0);
    expect(report.mismatched).toHaveLength(0);
    expect(code).toBe(0);
  });

  it("returns exit 2 with drift and no allow-drift", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-parity-drift-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    await runBackfillSocialflowOAuthConnections({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const targetPath = path.join(fixturesDir, "socialflow-oauth-connections.json");
    const targetRaw = await fs.readFile(targetPath, "utf8");
    const targetRows = JSON.parse(targetRaw) as Array<Record<string, unknown>>;
    targetRows[0] = {
      ...targetRows[0],
      status: "PENDING_REAL",
    };
    await fs.writeFile(targetPath, `${JSON.stringify(targetRows, null, 2)}\n`, "utf8");

    const code = await runCheckSocialflowOAuthConnectionsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(code).toBe(2);
  });

  it("returns exit 0 with drift when allow-drift is enabled", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-parity-allow-drift-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    await runBackfillSocialflowOAuthConnections({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    const targetPath = path.join(fixturesDir, "socialflow-oauth-connections.json");
    const targetRaw = await fs.readFile(targetPath, "utf8");
    const targetRows = JSON.parse(targetRaw) as Array<Record<string, unknown>>;
    targetRows[0] = {
      ...targetRows[0],
      scopes: "openid",
    };
    await fs.writeFile(targetPath, `${JSON.stringify(targetRows, null, 2)}\n`, "utf8");

    const code = await runCheckSocialflowOAuthConnectionsParityCli(
      [`--fixtures-dir=${fixturesDir}`, "--allow-drift"],
      { log: () => {}, error: () => {} },
    );
    expect(code).toBe(0);
  });

  it("fails closed when required binding or table is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-parity-fail-closed-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(
      fixturesDir,
      {
        ...BASE_SCHEMA,
        bindings: {
          ...BASE_SCHEMA.bindings,
          social: false,
        },
      },
      BASE_SOURCE,
      [],
    );

    const codeMissingBinding = await runCheckSocialflowOAuthConnectionsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(codeMissingBinding).toBe(1);

    await writeFixtures(
      fixturesDir,
      {
        ...BASE_SCHEMA,
        draco: {
          tables: ["drako_integration_connections"],
        },
      },
      BASE_SOURCE,
      [],
    );
    const codeMissingTable = await runCheckSocialflowOAuthConnectionsParityCli(
      [`--fixtures-dir=${fixturesDir}`],
      { log: () => {}, error: () => {} },
    );
    expect(codeMissingTable).toBe(1);
  });
});
