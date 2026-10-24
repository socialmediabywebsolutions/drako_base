import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runBackfillSocialflowOAuthConnections } from "../scripts/backfill-socialflow-oauth-connections";

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
    socialflowTokenEncryptionSecret: "local-socialflow-oauth-backfill-secret-1234567890",
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
  target: FixtureTarget,
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

describe("socialflow oauth connections backfill", () => {
  it("supports dry-run without mutating target fixtures", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-backfill-dry-run-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    const before = await fs.readFile(path.join(fixturesDir, "socialflow-oauth-connections.json"), "utf8");

    const report = await runBackfillSocialflowOAuthConnections({
      fixturesDir,
      dryRun: true,
      log: () => {},
    });

    const after = await fs.readFile(path.join(fixturesDir, "socialflow-oauth-connections.json"), "utf8");

    expect(report.mode).toBe("fixtures");
    expect(report.dryRun).toBe(true);
    expect(report.scanned).toBe(2);
    expect(report.selected).toBe(1);
    expect(report.inserts).toBe(1);
    expect(report.updates).toBe(0);
    expect(report.unchanged).toBe(0);
    expect(after).toBe(before);
  });

  it("applies inserts and remains idempotent on second execution", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-backfill-apply-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
    await writeFixtures(fixturesDir, BASE_SCHEMA, BASE_SOURCE, []);

    const firstApply = await runBackfillSocialflowOAuthConnections({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    expect(firstApply.inserts).toBe(1);
    expect(firstApply.updates).toBe(0);
    expect(firstApply.unchanged).toBe(0);

    const secondApply = await runBackfillSocialflowOAuthConnections({
      fixturesDir,
      dryRun: false,
      log: () => {},
    });

    expect(secondApply.inserts).toBe(0);
    expect(secondApply.updates).toBe(0);
    expect(secondApply.unchanged).toBe(1);
  });

  it("fails closed when a required binding is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-backfill-binding-missing-"));
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

    await expect(
      runBackfillSocialflowOAuthConnections({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_BINDING_MISSING:SOCIAL_DB");
  });

  it("fails closed when a required table is missing", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "drako-oauth-backfill-table-missing-"));
    const fixturesDir = path.join(tmpDir, "fixtures");
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

    await expect(
      runBackfillSocialflowOAuthConnections({
        fixturesDir,
        dryRun: false,
        log: () => {},
      }),
    ).rejects.toThrow("SOCIALFLOW_OAUTH_CONNECTIONS_BACKFILL_TABLE_MISSING:drako_integration_credentials");
  });
});
