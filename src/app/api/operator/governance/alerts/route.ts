export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { listOperatorGovernanceView } from "@/lib/ops/operator-governance-view";
import { deriveGovernanceAlerts, buildGovernanceAlertSummary, filterAndSortAlerts } from "@/lib/ops/governance-alerts";
import type { GovernanceAlertCategory, GovernanceAlertSeverity } from "@/lib/ops/governance-alerts";

function parseBool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function parseFilters(url: string): {
  severity?: GovernanceAlertSeverity;
  category?: GovernanceAlertCategory;
  saasSlug?: string;
  escalationSuggested?: boolean;
  search?: string;
  sort?: "priority" | "recent";
  limit: number;
  offset: number;
} {
  const params = new URL(url).searchParams;
  const limit = params.get("limit");
  const offset = params.get("offset");
  const sort = params.get("sort");

  return {
    severity: (params.get("severity") as GovernanceAlertSeverity) ?? undefined,
    category: (params.get("category") as GovernanceAlertCategory) ?? undefined,
    saasSlug: params.get("saasSlug") ?? undefined,
    escalationSuggested: parseBool(params.get("escalationSuggested")),
    search: params.get("search") ?? undefined,
    sort: sort === "recent" ? "recent" : "priority",
    limit: limit ? Number(limit) : 20,
    offset: offset ? Number(offset) : 0,
  };
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const filters = parseFilters(request.url);
    const { rows } = await listOperatorGovernanceView({ tenantId, limit: 200, offset: 0 });
    const alerts = deriveGovernanceAlerts(rows);
    const sorted = filterAndSortAlerts(alerts, filters);
    const summary = buildGovernanceAlertSummary(sorted);

    const start = filters.offset ?? 0;
    const end = start + (filters.limit ?? 20);
    const page = sorted.slice(start, end);

    return NextResponse.json({
      ok: true,
      data: page,
      summary,
      meta: {
        total: sorted.length,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: end < sorted.length,
        filters,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, code: error.message, message: error.message }, { status: error.status });
    }
    return NextResponse.json({ ok: false, code: "internal_error", message: (error as Error)?.message ?? "Unexpected error" }, { status: 500 });
  }
}
