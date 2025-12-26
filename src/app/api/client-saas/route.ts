import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";

export const runtime = "edge";

type ClientSaas = {
  id: string;
  client_id: string;
  saas_id: string;
  status: string;
  plan: string | null;
  created_at: string;
};

const fields = "id, client_id, saas_id, status, plan, created_at";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

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
    const clientId = url.searchParams.get("client_id");
    const conditions: string[] = ["tenant_id = ?"];
    const values: string[] = [tenantId];
    if (saasId) {
      conditions.push("saas_id = ?");
      values.push(saasId);
    }
    if (clientId) {
      conditions.push("client_id = ?");
      values.push(clientId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = await queryAll<ClientSaas>(
      `SELECT ${fields} FROM client_saas ${where} ORDER BY created_at DESC`,
      ...values
    );
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CLIENT_SAAS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<ClientSaas> | null;
    if (!body || !body.client_id || !body.saas_id) {
      return errorResponse("client_id and saas_id are required");
    }
    const id = body.id?.trim() || (globalThis.crypto?.randomUUID?.() ?? `link_${Date.now()}`);
    const ok = await run(
      `INSERT INTO client_saas (id, tenant_id, client_id, saas_id, status, plan) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      tenantId,
      body.client_id,
      body.saas_id,
      body.status ?? "active",
      body.plan ?? null
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to create link" }, { status: 500 });
    }
    const items = await queryAll<ClientSaas>(`SELECT ${fields} FROM client_saas WHERE id = ? AND tenant_id = ?`, id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CLIENT_SAAS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<ClientSaas> | null;
    if (!body?.id) {
      return errorResponse("id is required");
    }
    const fieldsToSet: string[] = [];
    const values: (string | null)[] = [];
    const allowed: (keyof ClientSaas)[] = ["client_id", "saas_id", "status", "plan"];
    for (const key of allowed) {
      if (typeof body[key] !== "undefined") {
        fieldsToSet.push(`${key} = ?`);
        values.push((body[key] as string) ?? null);
      }
    }
    if (fieldsToSet.length === 0) {
      return errorResponse("no fields to update");
    }
    values.push(body.id);
    values.push(tenantId);
    const ok = await run(`UPDATE client_saas SET ${fieldsToSet.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to update link" }, { status: 500 });
    }
    const items = await queryAll<ClientSaas>(`SELECT ${fields} FROM client_saas WHERE id = ? AND tenant_id = ?`, body.id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CLIENT_SAAS_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return errorResponse("id is required");
    }
    const ok = await run("DELETE FROM client_saas WHERE id = ? AND tenant_id = ?", id, tenantId);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to delete link" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CLIENT_SAAS_DELETE_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
