import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
export const runtime = "edge";


type Provision = {
  id: string;
  saas_id: string;
  step: string;
  status: string;
  details: string | null;
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
    const saasId = url.searchParams.get("saas_id");
    const sqlBase =
      "SELECT id, saas_id, step, status, details, created_at FROM provisioning WHERE tenant_id = ?";
    const order = " ORDER BY created_at DESC LIMIT 200";
    const items = saasId
      ? await queryAll<Provision>(`${sqlBase} AND saas_id = ?${order}`, tenantId, saasId)
      : await queryAll<Provision>(`${sqlBase}${order}`, tenantId);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("PROVISIONING_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as {
      saas_id?: string;
      step?: string; // init, pages_project, domain, connect, done, failed
      status?: string; // pending, running, completed, failed
      details?: string | null;
    } | null;
    if (!body || !body.saas_id || !body.step || !body.status) {
      return NextResponse.json({ error: "saas_id, step, status required" }, { status: 400 });
    }
    const id = globalThis.crypto?.randomUUID?.() ?? `prov_${Date.now()}`;
    const ok = await run(
      "INSERT INTO provisioning (id, tenant_id, saas_id, step, status, details) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      tenantId,
      body.saas_id,
      body.step,
      body.status,
      body.details ?? null
    );
    if (!ok) return NextResponse.json({ error: "failed to insert provisioning" }, { status: 500 });
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("PROVISIONING_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as {
      id?: string;
      status?: string; // pending, running, completed, failed
      step?: string;   // optional step change
      details?: string | null;
    } | null;
    if (!body || !body.id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const fields: string[] = [];
    const values: (string | null)[] = [];
    if (typeof body.status === "string") { fields.push("status = ?"); values.push(body.status); }
    if (typeof body.step === "string")   { fields.push("step = ?");   values.push(body.step); }
    if (typeof body.details !== "undefined") { fields.push("details = ?"); values.push(body.details ?? null); }
    if (fields.length === 0) {
      return NextResponse.json({ error: "no fields to update" }, { status: 400 });
    }
    values.push(body.id);
    values.push(tenantId);
    const ok = await run(
      `UPDATE provisioning SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
      ...values
    );
    if (!ok) return NextResponse.json({ error: "failed to update provisioning" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("PROVISIONING_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
