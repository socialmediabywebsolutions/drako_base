import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
export const runtime = "edge";


type Ticket = {
  id: string;
  client_id: string;
  saas_id: string | null;
  subject: string;
  description: string | null;
  status: string;
  priority: string;
  channel: string | null;
  created_at: string;
  closed_at: string | null;
};

const ticketFields = "id, client_id, saas_id, subject, description, status, priority, channel, created_at, closed_at";

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
    const values: string[] = [tenantId];
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
    const items = await queryAll<Ticket>(
      `SELECT ${ticketFields} FROM tickets ${where} ORDER BY created_at DESC`,
      ...values
    );
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("TICKETS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<Ticket> | null;
    if (!body || !body.client_id || !body.subject) {
      return errorResponse("client_id and subject are required");
    }
    const id = body.id?.trim() || (globalThis.crypto?.randomUUID?.() ?? `ticket_${Date.now()}`);
    const ok = await run(
      `INSERT INTO tickets (id, tenant_id, client_id, saas_id, subject, description, status, priority, channel) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      tenantId,
      body.client_id,
      body.saas_id ?? null,
      body.subject,
      body.description ?? null,
      body.status ?? "open",
      body.priority ?? "normal",
      body.channel ?? null
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to create ticket" }, { status: 500 });
    }
    const items = await queryAll<Ticket>(`SELECT ${ticketFields} FROM tickets WHERE id = ? AND tenant_id = ?`, id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("TICKETS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<Ticket> | null;
    if (!body?.id) {
      return errorResponse("id is required");
    }
    const fields: string[] = [];
    const values: (string | null)[] = [];
    const editable: (keyof Ticket)[] = ["status", "priority", "channel", "subject", "description", "closed_at", "saas_id"];
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
    const ok = await run(`UPDATE tickets SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to update ticket" }, { status: 500 });
    }
    const items = await queryAll<Ticket>(`SELECT ${ticketFields} FROM tickets WHERE id = ? AND tenant_id = ?`, body.id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("TICKETS_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
