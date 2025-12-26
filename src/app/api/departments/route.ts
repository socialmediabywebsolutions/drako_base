import { NextResponse } from "next/server";
import { queryAll } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";

export const runtime = "edge";

type Department = { id: string; name: string; description: string | null };

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const items = await queryAll<Department>(
      "SELECT id, name, description FROM departments WHERE tenant_id = ? ORDER BY name ASC",
      tenantId
    );
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEPARTMENTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
