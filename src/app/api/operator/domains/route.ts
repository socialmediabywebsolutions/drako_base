export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";


type DomainRow = {
  id: string;
  hostname: string;
  status: string;
  saas_id: string;
  saas_slug: string;
  tenant_id: string;
  last_error: string | null;
  verification_status: string | null;
  verification_reason: string | null;
  retry_count: number | null;
  updated_at: string;
};

type RoutingEventRow = {
  saas_id: string | null;
  type: string;
  severity: string;
  created_at: string;
  correlation_id: string;
};

function normalizeDomainStatus(status?: string | null): string {
  const normalized = status?.trim().toLowerCase() ?? "pending";
  if (normalized === "active") return "active";
  if (normalized === "paused") return "paused";
  if (normalized === "pending") return "pending";
  if (normalized === "pending_dns") return "pending";
  if (normalized === "error_check" || normalized === "error") return "pending";
  return "pending";
}

function normalizeVerificationStage(stage?: string | null): string | null {
  if (!stage) return null;
  return stage.trim().toLowerCase();
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const domains = await queryAll<DomainRow>(
      `SELECT d.id,
              d.domain as hostname,
              d.status,
              d.saas_id,
              s.slug as saas_slug,
              d.tenant_id,
              d.last_error,
              CASE WHEN 1=1 THEN d.verification_status END AS verification_status,
              CASE WHEN 1=1 THEN d.verification_reason END AS verification_reason,
              CASE WHEN 1=1 THEN d.retry_count END AS retry_count,
              d.updated_at
       FROM saas_domains d
       LEFT JOIN saas s ON s.id = d.saas_id AND s.tenant_id = d.tenant_id
       WHERE d.tenant_id = ?
       ORDER BY d.created_at DESC`,
      tenantId,
    );

    const saasIds = Array.from(new Set(domains.map((row) => row.saas_id))).filter(Boolean);
    let events: RoutingEventRow[] = [];
    if (saasIds.length > 0) {
      const placeholders = saasIds.map(() => "?").join(",");
      events = await queryAll<RoutingEventRow>(
        `SELECT saas_id, type, severity, created_at, correlation_id
         FROM campamento_events
         WHERE tenant_id = ?
           AND saas_id IN (${placeholders})
           AND type LIKE 'routing.resolve.%'
         ORDER BY created_at DESC`,
        tenantId,
        ...saasIds,
      );
    }

    const latestEventBySaas = new Map<string, RoutingEventRow>();
    events.forEach((event) => {
      if (!event.saas_id) return;
      if (!latestEventBySaas.has(event.saas_id)) {
        latestEventBySaas.set(event.saas_id, event);
      }
    });

    return NextResponse.json({
      domains: domains.map((domain) => {
        const event = latestEventBySaas.get(domain.saas_id);
        return {
          id: domain.id,
          hostname: domain.hostname,
          status: normalizeDomainStatus(domain.status),
          saasId: domain.saas_id,
          saasSlug: domain.saas_slug,
          tenantId: domain.tenant_id,
          lastError: domain.last_error ?? null,
          verificationStatus: normalizeVerificationStage(domain.verification_status),
          verificationReason: domain.verification_reason ?? null,
          retryCount: domain.retry_count ?? 0,
          updatedAt: domain.updated_at,
          lastRoutingEvent: event
            ? {
                type: event.type,
                severity: event.severity,
                createdAt: event.created_at,
                correlationId: event.correlation_id,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_DOMAINS_ERROR", error);
    return NextResponse.json({ code: "OWNER_DOMAINS_ERROR", message: "No se pudieron cargar los dominios" }, { status: 500 });
  }
}
