export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { UnauthorizedError, requireOwnerAccess } from "@/lib/auth/session";
import { runActionQueueRetention } from "@/lib/owner/action-queue-retention";


export async function POST(request: Request) {
  try {
    const { tenantId, session } = await requireOwnerAccess(request);
    if (session.role !== "admin") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Admin role required" }, { status: 403 });
    }
    const result = await runActionQueueRetention({ tenantId });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_ACTIONS_CLEANUP_ERROR", error);
    return NextResponse.json({ code: "OWNER_ACTIONS_CLEANUP_ERROR", message: "No se pudo limpiar el historial" }, { status: 500 });
  }
}
