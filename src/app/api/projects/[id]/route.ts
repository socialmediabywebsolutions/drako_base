import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
import { getProjectById } from "@/lib/projects/repository";

// export const runtime = "edge"; // OpenNext: disabled for bundling

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = id?.trim();
    const { tenantId } = await requireTenantAccess(req);
    if (!projectId) {
      return NextResponse.json({ ok: false, error: "project_id es obligatorio" }, { status: 400 });
    }

    const detail = await getProjectById({ tenantId, projectId });
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Proyecto no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, item: detail });
  } catch (error) {
    const authResponse = authErrorResponse(error);
    if (authResponse) return authResponse;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `project_detail_err_${Date.now()}`;
    console.error("PROJECT_DETAIL_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal server error", reason: "query_failed", correlationId },
      { status: 500 },
    );
  }
}
