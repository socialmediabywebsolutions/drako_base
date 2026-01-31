import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { respondDatabaseError } from "@/lib/http/errors";
// export const runtime = "edge"; // OpenNext Migration


type Metric = {
  id: number;
  scope: string;
  token_count: number;
  ai_cost_cents: number;
  roi: number;
  captured_at: string;
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
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const sqlBase =
      "SELECT id, scope, token_count, ai_cost_cents, roi, captured_at FROM metrics WHERE tenant_id = ?";
    const order = " ORDER BY captured_at DESC LIMIT ?";
    const items = scope ? await queryAll<Metric>(`${sqlBase} AND scope = ?${order}`, tenantId, scope, limit) : await queryAll<Metric>(`${sqlBase}${order}`, tenantId, limit);
    return NextResponse.json({ items, count: items.length, tenantId });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `metrics_err_${Date.now()}`;
    console.error("METRICS_GET_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal admin error", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as {
      scope?: string;
      token_count?: number;
      ai_cost_cents?: number;
      roi?: number;
    } | null;
    if (!body || !body.scope) return NextResponse.json({ error: "scope required" }, { status: 400 });
    const ok = await run("INSERT INTO metrics (tenant_id, scope, token_count, ai_cost_cents, roi) VALUES (?, ?, ?, ?, ?)", tenantId, body.scope, body.token_count ?? 0, body.ai_cost_cents ?? 0, body.roi ?? 0);
    if (!ok) return NextResponse.json({ error: "failed to insert metric" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    const correlationId = globalThis.crypto?.randomUUID?.() ?? `metrics_post_err_${Date.now()}`;
    console.error("METRICS_POST_ERROR", correlationId, error);
    return NextResponse.json(
      { ok: false, error: "Internal admin error", error_code: "INTERNAL_ERROR", correlation_id: correlationId },
      { status: 500 }
    );
  }
}
