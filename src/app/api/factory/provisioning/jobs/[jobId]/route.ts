import { NextRequest, NextResponse } from "next/server";
import { authorizeSaasAccess } from "@/lib/authz/saas-access";
import { queryOne } from "@/lib/db";
import { extractSessionFromRequest } from "@/lib/edge-auth";
import { JobRunner, type JobStepRecord } from "@/lib/provisioning/job-runner";

export const dynamic = "force-dynamic";

type ProvisioningJobRow = {
  job_id: string;
  entity_id: string;
  correlation_id: string;
  idempotency_key: string;
  current_state: string;
  execution_lock: number;
  lock_owner: string | null;
  retry_count: number | null;
  max_retries: number | null;
  last_error: string | null;
  step_history_json: string | null;
  rollback_history_json: string | null;
  created_at: string;
  updated_at: string;
};

type RollbackEntry = {
  step?: string;
  timestamp?: string;
  details?: string;
};

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function isOwnerRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "superadmin" || role === "admin";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const fallbackCorrelationId = globalThis.crypto?.randomUUID?.() ?? `owner_job_${Date.now()}`;

  try {
    const session = await extractSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { ok: false, code: "SESSION_REQUIRED", message: "Owner session is required." },
        { status: 401 },
      );
    }

    const access = await authorizeSaasAccess(session, req);
    if (!access.authorized) {
      const status = access.error === "UNAUTHORIZED" ? 401 : 403;
      return NextResponse.json(
        { ok: false, code: "OWNER_ACCESS_DENIED", message: access.error ?? "FORBIDDEN" },
        { status },
      );
    }

    if (!isOwnerRole(session.role)) {
      return NextResponse.json(
        { ok: false, code: "OWNER_ROLE_REQUIRED", message: "Only owner-level roles can inspect provisioning jobs." },
        { status: 403 },
      );
    }

    const { jobId } = await context.params;
    if (!jobId || jobId.trim().length < 6) {
      return NextResponse.json(
        { ok: false, code: "INVALID_JOB_ID", message: "jobId is required." },
        { status: 400 },
      );
    }

    const row = await queryOne<ProvisioningJobRow>(
      `SELECT job_id,
              entity_id,
              correlation_id,
              idempotency_key,
              current_state,
              execution_lock,
              lock_owner,
              retry_count,
              max_retries,
              last_error,
              step_history_json,
              rollback_history_json,
              created_at,
              updated_at
       FROM provisioning_jobs
       WHERE job_id = ?
         AND tenant_id = ?
       LIMIT 1`,
      jobId,
      session.tenantId,
    );

    if (!row) {
      return NextResponse.json(
        { ok: false, code: "JOB_NOT_FOUND", message: "Provisioning job not found for owner tenant." },
        { status: 404 },
      );
    }

    const stepHistory = parseJsonArray<JobStepRecord>(row.step_history_json);
    const rollbackHistory = parseJsonArray<RollbackEntry>(row.rollback_history_json);

    const timeline = [
      ...stepHistory.map((step) => ({
        type: "step",
        step: step.step,
        state: step.state,
        status: step.status,
        timestamp: step.timestamp,
        details: step.details ?? null,
      })),
      ...rollbackHistory.map((entry) => ({
        type: "rollback",
        step: entry.step ?? "ROLLBACK",
        state: "ROLLING_BACK",
        status: "ERROR",
        timestamp: entry.timestamp ?? row.updated_at,
        details: entry.details ?? null,
      })),
    ].sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));

    const correlationId = row.correlation_id || fallbackCorrelationId;

    return NextResponse.json({
      ok: true,
      canonical: true,
      correlationId,
      job: {
        jobId: row.job_id,
        saasId: row.entity_id,
        idempotencyKey: row.idempotency_key,
        state: JobRunner.toCanonicalState(row.current_state, row.execution_lock),
        rawState: row.current_state,
        lock: {
          active: row.execution_lock === 1,
          owner: row.lock_owner,
        },
        retries: {
          count: row.retry_count ?? 0,
          max: row.max_retries ?? 0,
        },
        error: row.last_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        timeline,
      },
    });
  } catch (error) {
    console.error("OWNER_SAAS_FACTORY_JOB_STATUS_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "INTERNAL_ERROR", correlationId: fallbackCorrelationId },
      { status: 500 },
    );
  }
}
