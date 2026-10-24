import { ensureDatabase, run } from "@/lib/db";

async function bootstrapObservabilityFallback(): Promise<void> {
  ensureDatabase();

  const createdFallback = await run(
    `CREATE TABLE IF NOT EXISTS campamento_event_fallbacks (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      step TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      error_message TEXT NOT NULL
    )`,
  );

  const createdMetrics = await run(
    `CREATE TABLE IF NOT EXISTS campamento_observability_metrics (
      date TEXT PRIMARY KEY,
      event_write_failures INTEGER NOT NULL DEFAULT 0,
      last_failure_at TEXT NOT NULL
    )`,
  );

  if (!createdFallback || !createdMetrics) {
    throw new Error("BOOTSTRAP_OBSERVABILITY_FAILED: unable to create fallback observability tables.");
  }

  console.log("OBSERVABILITY_BOOTSTRAP_OK");
}

bootstrapObservabilityFallback().catch((error) => {
  console.error("OBSERVABILITY_BOOTSTRAP_ERROR", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
