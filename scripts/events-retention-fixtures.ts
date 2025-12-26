import { runEventsRollupAndRetention } from "@/lib/empire/events-retention";
import { run } from "@/lib/db";

async function seedEvent(params: {
  tenantId: string;
  saasId?: string | null;
  type: string;
  severity: string;
  message: string;
  createdAt: string;
}) {
  const id = `evt_${Math.random().toString(16).slice(2)}`;
  await run(
    `INSERT INTO campamento_events (id, tenant_id, saas_id, type, severity, source, message, metadata, correlation_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'TEST', ?, NULL, ?, ?)`,
    id,
    params.tenantId,
    params.saasId ?? null,
    params.type,
    params.severity,
    params.message,
    `corr_${id}`,
    params.createdAt,
  );
}

async function runFixture() {
  const tenantId = "demo-tenant";
  const now = new Date();
  const old = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const oldCritical = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  await seedEvent({
    tenantId,
    type: "routing.resolve.miss",
    severity: "WARNING",
    message: "Old routing miss",
    createdAt: old,
  });

  await seedEvent({
    tenantId,
    type: "billing.webhook.unattributed",
    severity: "CRITICAL",
    message: "Old critical billing",
    createdAt: oldCritical,
  });

  const first = await runEventsRollupAndRetention({ tenantId });
  const second = await runEventsRollupAndRetention({ tenantId });

  if (second.rollupCount !== first.rollupCount) {
    throw new Error("Rollup idempotence failed");
  }

  console.log("events-retention fixtures OK", { first, second });
}

runFixture().catch((error) => {
  console.error(error);
  process.exit(1);
});
