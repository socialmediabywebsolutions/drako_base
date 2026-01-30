import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
// export const runtime = "edge"; // OpenNext Migration


type Invoice = {
  id: string;
  client_id: string;
  saas_id: string;
  number: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  period_from: string | null;
  period_to: string | null;
  issued_at: string | null;
  due_at: string | null;
  created_at: string;
  external_id: string | null;
  notes: string | null;
};

const invoiceFields = `id, client_id, saas_id, number, amount_cents, currency, status, period_from, period_to, issued_at, due_at, created_at, external_id, notes`;

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
    const clientId = url.searchParams.get("client_id");
    const saasId = url.searchParams.get("saas_id");
    const statusFilter = url.searchParams.get("status");
    const conditions: string[] = ["tenant_id = ?"];
    const values: (string | number)[] = [tenantId];
    if (clientId) {
      conditions.push("client_id = ?");
      values.push(clientId);
    }
    if (saasId) {
      conditions.push("saas_id = ?");
      values.push(saasId);
    }
    if (statusFilter) {
      conditions.push("status = ?");
      values.push(statusFilter);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = await queryAll<Invoice>(
      `SELECT ${invoiceFields} FROM invoices ${where} ORDER BY created_at DESC`,
      ...values
    );
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("INVOICES_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<Invoice> | null;
    if (!body || !body.client_id || !body.saas_id || typeof body.amount_cents !== "number") {
      return errorResponse("client_id, saas_id and amount_cents are required");
    }
    const id = body.id?.trim() || (globalThis.crypto?.randomUUID?.() ?? `inv_${Date.now()}`);
    const ok = await run(
      `INSERT INTO invoices (id, tenant_id, client_id, saas_id, number, amount_cents, currency, status, period_from, period_to, issued_at, due_at, external_id, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      id,
      tenantId,
      body.client_id,
      body.saas_id,
      body.number ?? null,
      body.amount_cents,
      body.currency ?? "EUR",
      body.status ?? "draft",
      body.period_from ?? null,
      body.period_to ?? null,
      body.issued_at ?? null,
      body.due_at ?? null,
      body.external_id ?? null,
      body.notes ?? null
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to create invoice" }, { status: 500 });
    }
    const items = await queryAll<Invoice>(`SELECT ${invoiceFields} FROM invoices WHERE id = ? AND tenant_id = ?`, id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("INVOICES_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<Invoice> | null;
    if (!body?.id) {
      return errorResponse("id is required");
    }
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const editable: (keyof Invoice)[] = [
      "client_id",
      "saas_id",
      "number",
      "amount_cents",
      "currency",
      "status",
      "period_from",
      "period_to",
      "issued_at",
      "due_at",
      "external_id",
      "notes",
    ];
    for (const key of editable) {
      if (typeof body[key] !== "undefined") {
        fields.push(`${key} = ?`);
        values.push((body[key] as string | number) ?? null);
      }
    }
    if (fields.length === 0) {
      return errorResponse("no fields to update");
    }
    values.push(body.id);
    values.push(tenantId);
    const ok = await run(`UPDATE invoices SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to update invoice" }, { status: 500 });
    }
    const items = await queryAll<Invoice>(`SELECT ${invoiceFields} FROM invoices WHERE id = ? AND tenant_id = ?`, body.id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("INVOICES_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
