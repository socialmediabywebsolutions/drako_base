import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";


type Grant = {
  id: string;
  title: string;
  region: string | null;
  deadline: string | null;
  budget_cents: number | null;
  requirements: string | null;
  link: string | null;
  status: string;
  created_at: string;
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
    const status = url.searchParams.get("status");
    const sqlBase =
      "SELECT id, title, region, deadline, budget_cents, requirements, link, status, created_at FROM grants";
    const order = " ORDER BY created_at DESC LIMIT 200";
    const conditions = ["tenant_id = ?"];
    const params: (string)[] = [tenantId];
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    const where = ` WHERE ${conditions.join(" AND ")}`;
    const items = await queryAll<Grant>(`${sqlBase}${where}${order}`, ...params);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("GRANTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as {
      id?: string; // allow upsert by id if provided
      title?: string;
      region?: string | null;
      deadline?: string | null;
      budget_cents?: number | null;
      requirements?: string | null;
      link?: string | null;
      status?: string; // new, candidate, submitted, won, lost
    } | null;
    if (!body || !body.title) return NextResponse.json({ error: "title required" }, { status: 400 });
    const id = body.id?.trim() ?? (globalThis.crypto?.randomUUID?.() ?? `grant_${Date.now()}`);
    if (body.id) {
      const existingGrant = await queryAll<{ tenant_id: string }>(
        "SELECT tenant_id FROM grants WHERE id = ? LIMIT 1",
        id,
      );
      if (existingGrant[0] && existingGrant[0].tenant_id !== tenantId) {
        return NextResponse.json({ error: "grant not found" }, { status: 404 });
      }
    }
    const ok = await run(
      "INSERT INTO grants (id, tenant_id, title, region, deadline, budget_cents, requirements, link, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, region=excluded.region, deadline=excluded.deadline, budget_cents=excluded.budget_cents, requirements=excluded.requirements, link=excluded.link, status=excluded.status WHERE tenant_id = excluded.tenant_id",
      id,
      tenantId,
      body.title,
      body.region ?? null,
      body.deadline ?? null,
      body.budget_cents ?? null,
      body.requirements ?? null,
      body.link ?? null,
      body.status ?? "new"
    );
    if (!ok) return NextResponse.json({ error: "failed to upsert grant" }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("GRANTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
