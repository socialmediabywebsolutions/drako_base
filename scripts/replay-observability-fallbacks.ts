import { fileURLToPath } from "node:url";
import path from "node:path";
import { queryAll, queryOne, run } from "@/lib/db";
import { recordCampamentoEvent } from "@/lib/empire/events";
import type { CampamentoEventSeverity } from "@/lib/empire/events";

type FallbackRow = {
  id: string;
  created_at: string;
  correlation_id: string;
  tenant_id: string;
  job_id: string;
  step: string;
  severity: string;
  message: string;
};

type ReplayReport = {
  scanned: number;
  replayed: number;
  alreadyExists: number;
  deleted: number;
  errors: number;
};

type ReplayOptions = {
  limit?: number;
  log?: (line: string) => void;
};

const DEFAULT_LIMIT = 100;

function normalizeSeverity(raw: string): CampamentoEventSeverity {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "WARNING" || normalized === "ERROR" || normalized === "CRITICAL") return normalized;
  return "INFO";
}

function normalizeStep(step: string): string {
  return step.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "_") || "unknown";
}

function toReplayType(step: string): string {
  return `observability.fallback.${normalizeStep(step)}.replayed`;
}

async function deleteFallback(id: string): Promise<boolean> {
  return run("DELETE FROM campamento_event_fallbacks WHERE id = ?", id);
}

export async function replayObservabilityFallbacks(options: ReplayOptions = {}): Promise<ReplayReport> {
  const requestedLimit = Number(options.limit ?? process.env.REPLAY_LIMIT ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(1000, Math.trunc(requestedLimit)))
    : DEFAULT_LIMIT;

  const logger = options.log ?? console.log;

  const rows = await queryAll<FallbackRow>(
    `SELECT id, created_at, correlation_id, tenant_id, job_id, step, severity, message
     FROM campamento_event_fallbacks
     ORDER BY created_at ASC
     LIMIT ?`,
    limit,
  );

  const report: ReplayReport = {
    scanned: rows.length,
    replayed: 0,
    alreadyExists: 0,
    deleted: 0,
    errors: 0,
  };

  for (const row of rows) {
    const replayType = toReplayType(row.step);

    try {
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM campamento_events
         WHERE tenant_id = ?
           AND correlation_id = ?
           AND type = ?
         LIMIT 1`,
        row.tenant_id,
        row.correlation_id,
        replayType,
      );

      if (existing) {
        report.alreadyExists += 1;
        const deletedExisting = await deleteFallback(row.id);
        if (deletedExisting) report.deleted += 1;
        else report.errors += 1;
        continue;
      }

      await recordCampamentoEvent({
        tenantId: row.tenant_id,
        type: replayType,
        severity: normalizeSeverity(row.severity),
        source: "OBSERVABILITY_REPLAY",
        message: row.message,
        metadata: {
          fallbackId: row.id,
          replayedAt: new Date().toISOString(),
          originalStep: row.step,
          jobId: row.job_id,
        },
        correlationId: row.correlation_id,
      });
      report.replayed += 1;

      const deleted = await deleteFallback(row.id);
      if (deleted) report.deleted += 1;
      else report.errors += 1;
    } catch (error) {
      report.errors += 1;
      logger(`REPLAY_OBSERVABILITY_ERROR fallbackId=${row.id} message=${error instanceof Error ? error.message : String(error)}`);
    }
  }

  logger(
    `REPLAY_OBSERVABILITY_REPORT scanned=${report.scanned} replayed=${report.replayed} alreadyExists=${report.alreadyExists} deleted=${report.deleted} errors=${report.errors}`,
  );

  return report;
}

async function runCli(): Promise<void> {
  try {
    await replayObservabilityFallbacks();
  } catch (error) {
    console.error(`REPLAY_OBSERVABILITY_FATAL ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const invokedAsScript = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (invokedAsScript) {
  void runCli();
}
