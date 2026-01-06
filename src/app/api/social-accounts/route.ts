import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";


type SocialAccount = {
  id: string;
  saas_id: string;
  platform: string;
  handle: string | null;
  url: string | null;
  is_connected: number;
  created_at: string;
  updated_at: string | null;
};

const accountFields = "id, saas_id, platform, handle, url, is_connected, created_at, updated_at";

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
    const conditions: string[] = ["tenant_id = ?"];
    const values: string[] = [tenantId];
    if (saasId) {
      conditions.push("saas_id = ?");
      values.push(saasId);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = await queryAll<SocialAccount>(
      `SELECT ${accountFields} FROM social_accounts ${where} ORDER BY created_at DESC`,
      ...values
    );
    return NextResponse.json({ items });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SOCIAL_ACCOUNTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<SocialAccount> | null;
    if (!body || !body.saas_id || !body.platform) {
      return errorResponse("saas_id and platform are required");
    }
    const id = body.id?.trim() || (globalThis.crypto?.randomUUID?.() ?? `social_${Date.now()}`);
    const ok = await run(
      `INSERT INTO social_accounts (id, tenant_id, saas_id, platform, handle, url, is_connected, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(saas_id, platform) DO UPDATE SET handle = excluded.handle, url = excluded.url, is_connected = excluded.is_connected, updated_at = excluded.updated_at`,
      id,
      tenantId,
      body.saas_id,
      body.platform.toLowerCase(),
      body.handle ?? null,
      body.url ?? null,
      typeof body.is_connected === "number" ? body.is_connected : 0,
      body.updated_at ?? new Date().toISOString()
    );
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to save account" }, { status: 500 });
    }
    const items = await queryAll<SocialAccount>(
      `SELECT ${accountFields} FROM social_accounts WHERE saas_id = ? AND platform = ? AND tenant_id = ?`,
      body.saas_id,
      body.platform.toLowerCase(),
      tenantId
    );
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SOCIAL_ACCOUNTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireTenantAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<SocialAccount> | null;
    if (!body?.id) {
      return errorResponse("id is required");
    }
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    const editable: (keyof SocialAccount)[] = ["platform", "handle", "url", "is_connected", "saas_id"];
    for (const key of editable) {
      if (typeof body[key] !== "undefined") {
        fields.push(`${key} = ?`);
        if (key === "is_connected" && typeof body[key] === "number") {
          values.push(body[key]);
        } else {
          values.push((body[key] as string) ?? null);
        }
      }
    }
    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    if (fields.length === 1) {
      return errorResponse("no fields to update");
    }
    values.push(body.id);
    values.push(tenantId);
    const ok = await run(`UPDATE social_accounts SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`, ...values);
    if (!ok) {
      return NextResponse.json({ ok: false, error: "failed to update account" }, { status: 500 });
    }
    const items = await queryAll<SocialAccount>(
      `SELECT ${accountFields} FROM social_accounts WHERE id = ? AND tenant_id = ?`,
      body.id,
      tenantId
    );
    return NextResponse.json({ ok: true, item: items[0] ?? null });
  } catch (error) {
    const response = authErrorResponse(error);
    if (response) return response;
    console.error("SOCIAL_ACCOUNTS_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal admin error" }, { status: 500 });
  }
}
