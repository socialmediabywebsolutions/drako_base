import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listSaasDomains, resolveSaasContext, upsertSaasDomain } from "@/lib/saas/repository";
import type { SaasDomainStatus } from "@/lib/saas/types";

export const runtime = "edge";

const DOMAIN_STATUSES: SaasDomainStatus[] = ["pending", "active", "paused"];

function normalizeDomainStatusInput(status?: string | null): SaasDomainStatus {
  const normalized = status?.trim().toLowerCase() ?? "pending";
  if (normalized === "active") return "active";
  if (normalized === "paused") return "paused";
  if (normalized === "pending") return "pending";
  if (normalized === "pending_dns") return "pending";
  if (normalized === "error_check" || normalized === "error") return "pending";
  return "pending";
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const { id: saasId } = await params;
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSaasContext({ tenantId, saasId });
    const items = await listSaasDomains(ctx, saasId);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SAAS_DOMAINS_LIST_ERROR", error);
    return NextResponse.json({ code: "SAAS_DOMAINS_ERROR", message: "No se pudieron cargar los dominios" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      domain?: string;
      isPrimary?: boolean;
      status?: SaasDomainStatus;
    } | null;
    const { id: saasId } = await params;
    if (!saasId || !body?.domain) {
      return NextResponse.json({ code: "INVALID_BODY", message: "domain is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveSaasContext({ tenantId, saasId });
    const resolvedStatus = normalizeDomainStatusInput(body.status);
    const status = DOMAIN_STATUSES.includes(resolvedStatus) ? resolvedStatus : "pending";
    const domain = await upsertSaasDomain(ctx, {
      id: body.id,
      saasId,
      domain: body.domain.trim(),
      isPrimary: body.isPrimary ?? false,
      status,
    });
    return NextResponse.json({ domain });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("SAAS_DOMAIN_UPSERT_ERROR", error);
    return NextResponse.json({ code: "SAAS_DOMAINS_ERROR", message: "No se pudo guardar el dominio" }, { status: 500 });
  }
}
