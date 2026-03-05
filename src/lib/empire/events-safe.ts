import { run } from "@/lib/db";
import { recordCampamentoEvent, type CampamentoEventInput } from "@/lib/empire/events";

type SafeWriteMode = "primary" | "fallback";

export type CampamentoEventSafeInput = CampamentoEventInput & {
  jobId: string;
  step: string;
};

export type CampamentoEventSafeResult = {
  ok: boolean;
  mode: SafeWriteMode;
};

function nowIso(): string {
  return new Date().toISOString();
}

function currentDateKey(isoValue: string): string {
  return isoValue.slice(0, 10);
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logStructuredError(payload: Record<string, unknown>): void {
  console.error(JSON.stringify(payload));
}

async function ensureFallbackTables(): Promise<void> {
  await run(
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

  await run(
    `CREATE TABLE IF NOT EXISTS campamento_observability_metrics (
      date TEXT PRIMARY KEY,
      event_write_failures INTEGER NOT NULL DEFAULT 0,
      last_failure_at TEXT NOT NULL
    )`,
  );
}

export async function recordCampamentoEventSafe(input: CampamentoEventSafeInput): Promise<CampamentoEventSafeResult> {
  try {
    await recordCampamentoEvent(input);
    return { ok: true, mode: "primary" };
  } catch (primaryError) {
    const errorMessage = stringifyError(primaryError);
    logStructuredError({
      code: "CAMPAMENTO_EVENT_WRITE_FAILED",
      correlationId: input.correlationId,
      tenantId: input.tenantId,
      jobId: input.jobId,
      step: input.step,
      severity: input.severity,
      error: errorMessage,
    });

    const createdAt = nowIso();
    const fallbackId = globalThis.crypto?.randomUUID?.() ?? `fallback_${Date.now()}`;
    const dateKey = currentDateKey(createdAt);

    try {
      await ensureFallbackTables();

      const insertedFallback = await run(
        `INSERT INTO campamento_event_fallbacks (
          id,
          created_at,
          correlation_id,
          tenant_id,
          job_id,
          step,
          severity,
          message,
          error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        fallbackId,
        createdAt,
        input.correlationId,
        input.tenantId,
        input.jobId,
        input.step,
        input.severity,
        input.message,
        errorMessage,
      );

      const updatedMetric = await run(
        `INSERT INTO campamento_observability_metrics (date, event_write_failures, last_failure_at)
         VALUES (?, 1, ?)
         ON CONFLICT(date) DO UPDATE SET
           event_write_failures = event_write_failures + 1,
           last_failure_at = excluded.last_failure_at`,
        dateKey,
        createdAt,
      );

      return { ok: Boolean(insertedFallback && updatedMetric), mode: "fallback" };
    } catch (fallbackError) {
      logStructuredError({
        code: "CAMPAMENTO_EVENT_FALLBACK_WRITE_FAILED",
        correlationId: input.correlationId,
        tenantId: input.tenantId,
        jobId: input.jobId,
        step: input.step,
        severity: input.severity,
        error: stringifyError(fallbackError),
      });
      return { ok: false, mode: "fallback" };
    }
  }
}
