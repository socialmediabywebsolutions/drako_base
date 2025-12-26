import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";

export const runtime = "edge";

type Owner = {
  id: string;
  name: string;
  nif: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  created_at: string;
};

const ownerFields = "id, name, nif, email, phone, country, city, address, created_at";

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
    const items = id
      ? await queryAll<Owner>(`SELECT ${ownerFields} FROM owners WHERE id = ? AND tenant_id = ? LIMIT 1`, id, tenantId)
      : await queryAll<Owner>(`SELECT ${ownerFields} FROM owners WHERE tenant_id = ? ORDER BY created_at DESC`, tenantId);
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("OWNERS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<Owner> | null;
    if (!body || !body.name) {
      return errorResponse("name is required");
    }
    const id = body.id?.trim() || (globalThis.crypto?.randomUUID?.() ?? `owner_${Date.now()}`);
    const ok = await run(
      `INSERT INTO owners (id, tenant_id, name, nif, email, phone, country, city, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      tenantId,
      body.name,
      body.nif ?? null,
      body.email ?? null,
      body.phone ?? null,
      body.country ?? null,
      body.city ?? null,
      body.address ?? null
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to create owner" }, { status: 500 });
    }
    const items = await queryAll<Owner>(`SELECT ${ownerFields} FROM owners WHERE id = ? AND tenant_id = ?`, id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("OWNERS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<Owner> | null;
    if (!body?.id) {
      return errorResponse("id is required");
    }
    const fields: string[] = [];
    const values: (string | null)[] = [];
    const map: (keyof Owner)[] = ["name", "nif", "email", "phone", "country", "city", "address"];
    for (const key of map) {
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
    const ok = await run(`UPDATE owners SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to update owner" }, { status: 500 });
    }
    const items = await queryAll<Owner>(`SELECT ${ownerFields} FROM owners WHERE id = ? AND tenant_id = ?`, body.id, tenantId);
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("OWNERS_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
