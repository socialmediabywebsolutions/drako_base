export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { listOperatorGovernanceView, type GovernanceFilters } from "@/lib/ops/operator-governance-view";
import { deriveGovernanceActions, buildDiagnosticSummary } from "@/lib/ops/governance-actions";

function parseValue(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key);
  return value ? value : undefined;
}

function parseFilters(url: string): Omit<GovernanceFilters, "tenantId"> {
  const params = new URL(url).searchParams;
  const limit = params.get("limit");
  const offset = params.get("offset");
  const sort = params.get("sort");
  return {
    status: parseValue(params, "status") as GovernanceFilters["status"],
    severity: parseValue(params, "severity") as GovernanceFilters["severity"],
    lifecycle: parseValue(params, "lifecycle"),
    billing: parseValue(params, "billing"),
    provisioning: parseValue(params, "provisioning"),
    domainStatus: parseValue(params, "domainStatus"),
    saasSlug: parseValue(params, "saasSlug"),
    search: parseValue(params, "search"),
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined,
    sort: sort === "recent" ? "recent" : "priority",
  };
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const filters = parseFilters(request.url);
    const { rows, summary } = await listOperatorGovernanceView({ ...filters, tenantId });
    const enriched = rows.map((row) => ({
      ...row,
      actions: deriveGovernanceActions(row),
      diagnosticSummary: buildDiagnosticSummary(row),
    }));

    return NextResponse.json({
      ok: true,
      data: enriched,
      summary,
      meta: {
        total: summary.total,
        limit: filters.limit ?? rows.length,
        offset: filters.offset ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message, message: error.message }, { status: error.status });
    }
    console.error("OWNER_GOVERNANCE_VIEW_ERROR", error);
    return NextResponse.json({ ok: false, code: "OWNER_GOVERNANCE_VIEW_ERROR", message: "Failed to load governance view" }, { status: 500 });
  }
}
