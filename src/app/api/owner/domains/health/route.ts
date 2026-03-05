export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";

type PendingDomainRow = {
  id: string;
  hostname: string;
  status: string;
  saas_id: string;
  updated_at: string;
};

type DegradedJobRow = {
  job_id: string;
  saas_id: string;
  current_state: string;
  updated_at: string;
  last_error: string | null;
  hostname: string | null;
  domain_status: string | null;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const PENDING_DOMAIN_THRESHOLD = 3;
const DEGRADED_JOBS_THRESHOLD = 1;

function resolveLimit(url: string): number {
  const parsed = new URL(url);
  const raw = Number(parsed.searchParams.get("limit") ?? String(DEFAULT_LIMIT));
  if (!Number.isFinite(raw)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(raw)));
}

function buildRecommendations(params: {
  pendingDomains: Array<{ hostname: string }>;
  degradedJobs: Array<{ jobId: string; hostname: string | null }>;
}): string[] {
  const recommendations: string[] = [];
  if (params.pendingDomains.length > 0) {
    recommendations.push(`Re-run verify for hostname ${params.pendingDomains[0].hostname}`);
  }
  if (params.degradedJobs.length > 0) {
    recommendations.push(`Inspect degraded job ${params.degradedJobs[0].jobId}`);
  }
  if (params.pendingDomains.length > 0 || params.degradedJobs.length > 0) {
    recommendations.push("Run replay:observability");
  }
  if (recommendations.length === 0) {
    recommendations.push("Domains health is stable");
  }
  return recommendations;
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const limit = resolveLimit(request.url);

    const pendingDomainsRows = await queryAll<PendingDomainRow>(
      `SELECT id,
              domain AS hostname,
              status,
              saas_id,
              updated_at
       FROM saas_domains
       WHERE tenant_id = ?
         AND lower(status) IN ('pending', 'provisioning')
       ORDER BY updated_at DESC
       LIMIT ?`,
      tenantId,
      limit,
    );

    const degradedJobRows = await queryAll<DegradedJobRow>(
      `SELECT j.job_id,
              j.entity_id AS saas_id,
              j.current_state,
              j.updated_at,
              j.last_error,
              d.domain AS hostname,
              d.status AS domain_status
       FROM provisioning_jobs j
       LEFT JOIN saas_domains d
         ON d.saas_id = j.entity_id
        AND d.tenant_id = j.tenant_id
       WHERE j.tenant_id = ?
         AND j.type = 'SAAS_PROVISIONING'
         AND j.current_state = 'DEGRADED'
       ORDER BY j.updated_at DESC
       LIMIT ?`,
      tenantId,
      limit,
    );

    const pendingDomains = pendingDomainsRows.map((row) => ({
      id: row.id,
      hostname: row.hostname,
      status: row.status,
      saasId: row.saas_id,
      updatedAt: row.updated_at,
    }));
    const degradedJobs = degradedJobRows.map((row) => ({
      jobId: row.job_id,
      saasId: row.saas_id,
      state: row.current_state,
      hostname: row.hostname,
      domainStatus: row.domain_status,
      lastError: row.last_error,
      updatedAt: row.updated_at,
    }));

    const degraded = pendingDomains.length > PENDING_DOMAIN_THRESHOLD || degradedJobs.length > DEGRADED_JOBS_THRESHOLD;
    const recommendations = buildRecommendations({ pendingDomains, degradedJobs });

    return NextResponse.json({
      ok: true,
      tenantId,
      limit,
      pendingDomains,
      degradedJobs,
      recommendations,
      slo: {
        degraded,
        pendingDomainsThreshold: PENDING_DOMAIN_THRESHOLD,
        degradedJobsThreshold: DEGRADED_JOBS_THRESHOLD,
        pendingDomainsCount: pendingDomains.length,
        degradedJobsCount: degradedJobs.length,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, code: error.message, message: error.message },
        { status: error.status },
      );
    }

    console.error("OWNER_DOMAINS_HEALTH_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "OWNER_DOMAINS_HEALTH_ERROR", message: "Failed to load owner domains health" },
      { status: 500 },
    );
  }
}
