export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { CRM_PLANS, isCrmPlan } from "@/lib/drako/crm-plans";


type Client = {
  id: string;
  owner_id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

const clientFields = "id, owner_id, name, nif, email, phone, country, city, address, created_at";

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
    const id = url.searchParams.get("id");
    const ownerId = url.searchParams.get("owner_id");
    const search = url.searchParams.get("search");
    if (id) {
      const items = await queryAll<Client>(
        `SELECT ${clientFields} FROM clients WHERE id = ? AND tenant_id = ? LIMIT 1`,
        id,
        tenantId,
      );
      return NextResponse.json({ items });
    }
    const conditions: string[] = [];
    const values: string[] = [];
    conditions.push("tenant_id = ?");
    values.push(tenantId);
    if (ownerId) {
      conditions.push("owner_id = ?");
      values.push(ownerId);
    }
    if (search) {
      conditions.push("(LOWER(name) LIKE ? OR LOWER(IFNULL(nif, '')) LIKE ?)");
      const term = `%${search.toLowerCase()}%`;
      values.push(term, term);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = await queryAll<Client>(`SELECT ${clientFields} FROM clients ${where} ORDER BY created_at DESC`, ...values);
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CLIENTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, session } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as (Partial<Client> & { plan?: unknown; notes?: unknown }) | null;
    if (!body || !body.name?.trim()) {
      return errorResponse("name is required");
    }
    // plan + notes opcionales: "＋ Crear venta" del CRM de /operator/socialflow registra
    // además la venta en drako_crm_sales (migración 0208).
    const plan = typeof body.plan === "string" ? body.plan.toLowerCase() : null;
    if (plan !== null && !isCrmPlan(plan)) {
      return errorResponse("invalid plan");
    }
    // Sin owner_id (alta desde el CRM): el owner del tenant o, si no tiene, el owner
    // principal del holding — clients.owner_id es NOT NULL.
    const ownerId =
      body.owner_id
      ?? (await queryAll<{ id: string }>(`SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at LIMIT 1`, tenantId))[0]?.id
      ?? (await queryAll<{ id: string }>(`SELECT id FROM owners ORDER BY created_at LIMIT 1`))[0]?.id;
    if (!ownerId) {
      return errorResponse("owner_id is required (no owner configured for this tenant)");
    }
    const id = body.id?.trim() || (globalThis.crypto?.randomUUID?.() ?? `client_${Date.now()}`);
    const ok = await run(
      `INSERT INTO clients (id, owner_id, name, nif, email, phone, country, city, address, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      ownerId,
      body.name.trim(),
      body.nif ?? null,
      body.email ?? null,
      body.phone ?? null,
      body.country ?? null,
      body.city ?? null,
      body.address ?? null,
      tenantId,
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to create client" }, { status: 500 });
    }
    if (plan && isCrmPlan(plan)) {
      await run(
        `INSERT INTO drako_crm_sales (client_id, plan, amount_monthly, notes, created_by) VALUES (?, ?, ?, ?, ?)`,
        id,
        plan,
        CRM_PLANS[plan].monthly,
        typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        session.email ?? null,
      );
    }
    const items = await queryAll<Client>(
      `SELECT ${clientFields} FROM clients WHERE id = ? AND tenant_id = ?`,
      id,
      tenantId,
    );
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CLIENTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<Client> | null;
    if (!body?.id) {
      return errorResponse("id is required");
    }
    const fields: string[] = [];
    const values: (string | null)[] = [];
    const editable: (keyof Client)[] = ["name", "nif", "email", "phone", "country", "city", "address", "owner_id"];
    for (const key of editable) {
      if (typeof body[key] !== "undefined") {
        fields.push(`${key} = ?`);
        values.push((body[key] as string) ?? null);
      }
    }
    if (fields.length === 0) {
      return errorResponse("no fields to update");
    }
    values.push(body.id);
    values.push(tenantId);
    const ok = await run(`UPDATE clients SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to update client" }, { status: 500 });
    }
    const items = await queryAll<Client>(
      `SELECT ${clientFields} FROM clients WHERE id = ? AND tenant_id = ?`,
      body.id,
      tenantId,
    );
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("CLIENTS_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
