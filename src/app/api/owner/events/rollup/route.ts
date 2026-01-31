import { NextResponse } from "next/server";
import { UnauthorizedError, requireTenantAccess } from "@/lib/auth/session";
import { runEventsRollupAndRetention } from "@/lib/empire/events-retention";
// export const runtime = "edge"; // OpenNext Migration


export async function POST(request: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (session.role !== "admin") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Admin role required" }, { status: 403 });
    }
    const result = await runEventsRollupAndRetention({ tenantId });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_EVENTS_ROLLUP_ERROR", error);
    return NextResponse.json({ code: "OWNER_EVENTS_ROLLUP_ERROR", message: "No se pudo ejecutar el rollup" }, { status: 500 });
  }
}
