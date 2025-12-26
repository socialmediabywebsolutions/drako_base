import { createOrMergeActionFromWebhook, transitionActionStatus } from "@/lib/owner/action-queue-repository";
import { runActionQueueRetention } from "@/lib/owner/action-queue-retention";
import { run } from "@/lib/db";

async function seedOldClosedAction(tenantId: string, actionKey: string, daysAgo: number) {
  const timestamp = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  await run(
    `INSERT INTO campamento_actions (
      id, tenant_id, saas_id, saas_slug, category, priority, source, title, summary, description, action_key, status,
      correlation_id, last_seen_at, seen_count, metadata, created_at, updated_at, resolved_at, snoozed_until
     ) VALUES (?, ?, NULL, NULL, 'BILLING', 'NORMAL', 'fixture', 'Closed action', 'Closed action', 'Closed action', ?, 'EXECUTED',
      ?, ?, 1, NULL, ?, ?, ?, NULL)`,
    `act_${Math.random().toString(16).slice(2)}`,
    tenantId,
    actionKey,
    `corr_${actionKey}`,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
    timestamp,
  );
}

async function runFixture() {
  const tenantId = "demo-tenant";
  const actionKey = "billing:global:duplicate action";

  await createOrMergeActionFromWebhook({
    tenantId,
    category: "BILLING",
    priority: "NORMAL",
    title: "Duplicate action",
    description: "Fixture action",
    source: "fixture",
    actionKey,
  });
  await createOrMergeActionFromWebhook({
    tenantId,
    category: "BILLING",
    priority: "HIGH",
    title: "Duplicate action",
    description: "Fixture action",
    source: "fixture",
    actionKey,
  });
  await createOrMergeActionFromWebhook({
    tenantId,
    category: "BILLING",
    priority: "CRITICAL",
    title: "Duplicate action",
    description: "Fixture action",
    source: "fixture",
    actionKey,
  });

  const action = await createOrMergeActionFromWebhook({
    tenantId,
    category: "BILLING",
    priority: "CRITICAL",
    title: "Duplicate action",
    description: "Fixture action",
    source: "fixture",
    actionKey,
  });

  if (!action) {
    throw new Error("No action created");
  }

  await transitionActionStatus({
    tenantId,
    id: action.id,
    status: "DISMISSED",
    actor: "fixture",
  });

  await seedOldClosedAction(tenantId, "billing:global:old", 90);

  const cleanup = await runActionQueueRetention({
    tenantId,
    envOverride: { DRACO_ACTIONS_HISTORY_RETENTION_DAYS: "60" },
  });

  const second = await runActionQueueRetention({
    tenantId,
    envOverride: { DRACO_ACTIONS_HISTORY_RETENTION_DAYS: "60" },
  });

  if (cleanup.purged !== second.purged) {
    throw new Error("Retention idempotence failed");
  }

  console.log("action-queue fixtures OK", { cleanup, second });
}

runFixture().catch((error) => {
  console.error(error);
  process.exit(1);
});
