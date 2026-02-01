import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import { listCompanyDomainsForCompany } from "@/lib/company-domains/domains";

// export const runtime = "edge"; // OpenNext: disabled for bundling


type RouteContext = {
  params: Promise<{ id: string }>;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const companyId = id?.trim();
    if (!id) {
      return NextResponse.json({ ok: false, error: "company_id_required" }, { status: 400 });
    }

    const { tenantId } = await requireTenantAccess(req);
    const domains = await listCompanyDomainsForCompany(tenantId, companyId ?? id);
    return NextResponse.json({ ok: true, tenantId, companyId: companyId ?? id, domains });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `company_domains_show_err_${Date.now()}`;
    console.error("COMPANY_DOMAIN_LIST_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "query_failed", correlationId },
      { status: 500 },
    );
  }
}
