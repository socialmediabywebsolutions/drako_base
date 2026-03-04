export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { UnauthorizedError, requireOwnerAccess } from "@/lib/auth/session";
import { transitionActionStatus } from "@/lib/owner/action-queue-repository";



type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { tenantId, session } = await requireOwnerAccess(request);
    if (session.role !== "admin") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Admin role required" }, { status: 403 });
    }
    const { id } = await params;
    const ok = await transitionActionStatus({
      tenantId,
      id,
      status: "DISMISSED",
      actor: session.email,
      correlationId: `action_${id}`,
    });
    if (!ok) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Action not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_ACTION_DISMISS_ERROR", error);
    return NextResponse.json({ code: "OWNER_ACTION_DISMISS_ERROR", message: "No se pudo descartar la accion" }, { status: 500 });
  }
}
