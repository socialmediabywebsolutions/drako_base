import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll, run } from "@/lib/db";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { verifyDomainMapping } from "@/lib/empire/domain-verifier";
export const runtime = "edge";


type DomainRow = {
  id: string;
  domain: string;
  status: string;
  tenant_id: string;
  saas_id: string;
  saas_slug: string | null;
  retry_count: number | null;
};

type VerifyPayload = {
  scope?: "all" | "saas" | "domain";
  saasId?: string;
  domain?: string;
};

function generateCorrelationId() {
  return globalThis.crypto?.randomUUID?.() ?? `verify_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const payload = (await request.json().catch(() => null)) as VerifyPayload | null;
    const scope = payload?.scope ?? "all";
    const filters: string[] = ["d.tenant_id = ?"];
    const params: Array<string> = [tenantId];

    if (scope === "all") {
      filters.push("lower(d.status) IN ('pending', 'pending_dns', 'error_check', 'error')");
      filters.push("(d.verification_status IS NULL OR lower(d.verification_status) != 'verified')");
    }
    if (scope === "saas" && payload?.saasId) {
      filters.push("d.saas_id = ?");
      params.push(payload.saasId);
    }
    if (scope === "domain" && payload?.domain) {
      filters.push("lower(d.domain) = ?");
      params.push(payload.domain.trim().toLowerCase());
    }

    const rows = await queryAll<DomainRow>(
      `SELECT d.id,
              d.domain,
              d.status,
              d.tenant_id,
              d.saas_id,
              s.slug as saas_slug,
              d.retry_count
       FROM saas_domains d
       LEFT JOIN saas s ON s.id = d.saas_id AND s.tenant_id = d.tenant_id
       WHERE ${filters.join(" AND ")}
       ORDER BY d.created_at DESC
       LIMIT 200`,
      ...params,
    );

    const correlationId = generateCorrelationId();
    await recordCampamentoEvent({
      tenantId,
      type: "provision.domain.verify.started",
      severity: "INFO",
      source: "DOMAIN_VERIFIER",
      message: `Verificacion iniciada (${rows.length} dominios).`,
      metadata: { scope, saasId: payload?.saasId ?? null },
      correlationId,
    });

    const now = new Date().toISOString();
    for (const row of rows) {
      const result = await verifyDomainMapping({
        hostname: row.domain,
        tenantId: row.tenant_id,
        saasId: row.saas_id,
        saasSlug: row.saas_slug,
        currentStatus: row.status,
      });

      const retryCount = (row.retry_count ?? 0) + (result.nextStatus === "active" ? 0 : 1);
      const nextStatus = result.nextStatus;
      const verificationStage = retryCount >= 3 && nextStatus !== "active" ? "failed" : result.verificationStage;
      const verificationReason = result.reason ?? null;

      await run(
        `UPDATE saas_domains
         SET status = ?, verification_status = ?, verification_reason = ?, last_error = ?, retry_count = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ?`,
        nextStatus,
        verificationStage,
        verificationReason,
        verificationStage === "failed" ? verificationReason : null,
        retryCount,
        now,
        row.id,
        tenantId,
      );

      await recordCampamentoEvent({
        tenantId,
        saasId: row.saas_id,
        type: nextStatus === "active" ? "provision.domain.verify.done" : "provision.domain.verify.failed",
        severity: nextStatus === "active" ? "INFO" : "WARNING",
        source: "DOMAIN_VERIFIER",
        message: `Verificacion dominio ${row.domain}: ${nextStatus}.`,
        metadata: {
          saasSlug: row.saas_slug,
          nextStatus,
          verificationStage,
          reason: verificationReason,
          retryCount,
          metrics: result.metrics,
        },
        correlationId,
      });
    }

    return NextResponse.json({ ok: true, count: rows.length });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_DOMAINS_VERIFY_ERROR", error);
    return NextResponse.json({ code: "OWNER_DOMAINS_VERIFY_ERROR", message: "No se pudo verificar dominios" }, { status: 500 });
  }
}
