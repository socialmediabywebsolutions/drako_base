export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { buildOwnerControlSnapshot } from "@/lib/owner/control-dashboard";


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "OWNER_CONTROL_MISSING_CONTEXT", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const snapshot = await buildOwnerControlSnapshot({ tenantId, saasId });
    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_CONTROL_SNAPSHOT_ERROR", error);
    return NextResponse.json(
      { code: "OWNER_CONTROL_UNEXPECTED_ERROR", message: "No se pudo cargar el snapshot del owner." },
      { status: 500 },
    );
  }
}
