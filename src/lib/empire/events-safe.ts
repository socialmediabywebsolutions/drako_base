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

function isSchemaMissingError(error: unknown): boolean {
  const message = stringifyError(error).toLowerCase();
  return message.includes("no such table")
    || message.includes("no such column")
    || message.includes("table-missing")
    || message.includes("migrations-missing");
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

      if (!insertedFallback || !updatedMetric) {
        logStructuredError({
          code: "CAMPAMENTO_EVENT_FALLBACK_WRITE_FAILED",
          correlationId: input.correlationId,
          tenantId: input.tenantId,
          jobId: input.jobId,
          step: input.step,
          severity: input.severity,
          error: "Fallback persistence returned unsuccessful status.",
        });
        return { ok: false, mode: "fallback" };
      }

      return { ok: true, mode: "fallback" };
    } catch (fallbackError) {
      if (isSchemaMissingError(fallbackError)) {
        logStructuredError({
          code: "CAMPAMENTO_EVENT_FALLBACK_SCHEMA_MISSING",
          correlationId: input.correlationId,
          tenantId: input.tenantId,
          jobId: input.jobId,
          step: input.step,
          severity: input.severity,
          error: stringifyError(fallbackError),
        });
        return { ok: false, mode: "fallback" };
      }

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
