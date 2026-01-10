import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import { listCompanyDomains } from "@/lib/company-domains/domains";

export const runtime = "edge";


function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const url = new URL(req.url);
    const companyId = url.searchParams.get("company_id") ?? url.searchParams.get("saas_id");
    const status = url.searchParams.get("status");

    const domains = await listCompanyDomains(tenantId, { companyId, status });
    return NextResponse.json({ ok: true, tenantId, domains });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `company_domains_get_err_${Date.now()}`;
    console.error("COMPANY_DOMAINS_GET_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "query_failed", correlationId },
      { status: 500 }
    );
  }
}
