import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "../..");
const addPriceMigration = fs.readFileSync(
  path.join(projectRoot, "workers/autopilot-worker/migrations/0138_saas_subscriptions_stripe_price_id.sql"),
  "utf8",
);
const statusAlignmentMigration = fs.readFileSync(
  path.join(projectRoot, "workers/autopilot-worker/migrations/0139_saas_subscriptions_status_alignment.sql"),
  "utf8",
);
const quotasAlignmentMigration = fs.readFileSync(
  path.join(projectRoot, "workers/autopilot-worker/migrations/0140_saas_usage_quotas_runtime_alignment.sql"),
  "utf8",
);
const subscriptions = fs.readFileSync(path.join(projectRoot, "src/lib/billing/subscriptions.ts"), "utf8");
const provisioningWorkflow = fs.readFileSync(path.join(projectRoot, "src/lib/billing/provisioning_workflow.ts"), "utf8");

describe("saas_subscriptions schema alignment", () => {
  it("adds stripe_price_id required by canonical billing writes", () => {
    expect(addPriceMigration).toContain("ALTER TABLE saas_subscriptions ADD COLUMN stripe_price_id TEXT;");
    expect(subscriptions).toContain("stripe_price_id");
  });

  it("accepts the canonical Stripe status set used by billing runtime", () => {
    expect(statusAlignmentMigration).toContain("'trialing'");
    expect(statusAlignmentMigration).toContain("'incomplete'");
    expect(statusAlignmentMigration).toContain("'incomplete_expired'");
    expect(statusAlignmentMigration).toContain("ALTER TABLE saas_subscriptions RENAME TO saas_subscriptions_legacy_0139;");
    expect(statusAlignmentMigration).toContain("DROP TABLE saas_subscriptions_legacy_0139;");
    expect(subscriptions).toContain("\"trialing\"");
    expect(subscriptions).toContain("\"incomplete\"");
  });

  it("aligns quota storage with the billing runtime columns and conflict target", () => {
    expect(quotasAlignmentMigration).toContain("updated_at TEXT");
    expect(quotasAlignmentMigration).toContain("UNIQUE(saas_slug, tenant_id, quota_key)");
    expect(quotasAlignmentMigration).toContain("ALTER TABLE saas_usage_quotas RENAME TO saas_usage_quotas_legacy_0140;");
    expect(provisioningWorkflow).toContain("updated_at");
    expect(provisioningWorkflow).toContain("ON CONFLICT(saas_slug, tenant_id, quota_key)");
    expect(subscriptions).toContain("ON CONFLICT(saas_slug, tenant_id, quota_key)");
  });
});
