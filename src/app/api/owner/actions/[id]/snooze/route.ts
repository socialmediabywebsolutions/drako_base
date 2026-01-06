import { NextResponse } from "next/server";
import { UnauthorizedError, requireTenantAccess } from "@/lib/auth/session";
import { transitionActionStatus } from "@/lib/owner/action-queue-repository";
export const runtime = "edge";


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { tenantId, session } = await requireTenantAccess(request);
    if (session.role !== "admin") {
      return NextResponse.json({ code: "FORBIDDEN", message: "Admin role required" }, { status: 403 });
    }
    const body = (await request.json().catch(() => null)) as { snoozedUntil?: string | null } | null;
    const { id } = await params;
    const snoozedUntil = body?.snoozedUntil ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const ok = await transitionActionStatus({
      tenantId,
      id,
      status: "SNOOZED",
      actor: session.email,
      correlationId: `action_${id}`,
      snoozedUntil,
    });
    if (!ok) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Action not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, snoozedUntil });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_ACTION_SNOOZE_ERROR", error);
    return NextResponse.json({ code: "OWNER_ACTION_SNOOZE_ERROR", message: "No se pudo posponer la accion" }, { status: 500 });
  }
}
