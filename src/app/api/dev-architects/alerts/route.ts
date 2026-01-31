import { NextResponse } from "next/server";
import { env, type DracoEnv } from "@/lib/cf";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { listDevArchitectAlerts, syncDevArchitectAuditAlert } from "@/lib/dev-architects/store";
import type { DevArchitectAlertSeverity } from "@/lib/dev-architects/types";
// export const runtime = "edge"; // OpenNext Migration


async function resolveTenantId(req: Request): Promise<string> {
  const url = new URL(req.url);
  const explicit = url.searchParams.get("tenantId") ?? req.headers.get("x-tenant-id") ?? undefined;
  if (explicit) return explicit;
  try {
    const { tenantId } = await requireTenantAccess(req);
    return tenantId;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return "demo-tenant";
    }
    throw error;
  }
}

function authErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const tenantId = await resolveTenantId(req);
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const status = url.searchParams.get("status") as ("open" | "resolved") | null;
    const bindings: DracoEnv | null = env();
    const items = await listDevArchitectAlerts(tenantId, bindings, projectId, status ?? undefined);
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_ALERTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantId = await resolveTenantId(req);
    const body = (await req.json().catch(() => null)) as {
      projectId?: string;
      status?: "open" | "resolved";
      severity?: DevArchitectAlertSeverity;
      message?: string;
      pendingRules?: string[];
    } | null;
    if (!body?.projectId || !body.status) {
      return NextResponse.json({ ok: false, error: "projectId y status son obligatorios" }, { status: 400 });
    }
    const bindings: DracoEnv | null = env();
    await syncDevArchitectAuditAlert(tenantId, bindings, {
      project_id: body.projectId,
      status: body.status,
      severity: body.severity,
      message: body.message,
      pending_rules: body.pendingRules,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("DEVARCH_ALERTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal devarchitect error" }, { status: 500 });
  }
}
