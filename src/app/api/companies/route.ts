import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";

export const runtime = "edge";


type CompanyRecord = {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  created_at: string | null;
};

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const companies = await queryAll<CompanyRecord>(
      "SELECT id, slug, name, description, created_at FROM companies ORDER BY name ASC"
    );
    return NextResponse.json({ ok: true, tenantId, companies });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `companies_get_err_${Date.now()}`;
    console.error("COMPANIES_GET_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "query_failed", correlationId },
      { status: 500 }
    );
  }
}
