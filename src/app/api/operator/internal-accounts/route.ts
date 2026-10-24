export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";

// GET  → list all internal accounts
// POST → add a tenant to internal_accounts
// DELETE → remove a tenant from internal_accounts

export async function GET(req: Request) {
  try {
    await requireOwnerAccess(req);

    const url = new URL(req.url);
    const saasSlug = url.searchParams.get("saasSlug")?.trim() || "";

    let rows: Array<{ tenant_id: string; saas_slug: string; label: string | null; added_at: string }>;
    if (saasSlug) {
      rows = await queryAll(
        `SELECT tenant_id, saas_slug, label, added_at FROM internal_accounts WHERE saas_slug = ? ORDER BY added_at DESC`,
        saasSlug,
      ) as typeof rows;
    } else {
      rows = await queryAll(
        `SELECT tenant_id, saas_slug, label, added_at FROM internal_accounts ORDER BY added_at DESC`,
      ) as typeof rows;
    }

    const accounts = rows.map((r) => ({
      tenantId: r.tenant_id,
      saasSlug: r.saas_slug,
      label: r.label ?? null,
      addedAt: r.added_at,
    }));

    return NextResponse.json({ ok: true, accounts });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("INTERNAL_ACCOUNTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await requireOwnerAccess(req);

    const body = await req.json().catch(() => null) as {
      tenantId?: string;
      saasSlug?: string;
      label?: string;
    } | null;

    const tenantId = body?.tenantId?.trim();
    const saasSlug = body?.saasSlug?.trim() || "socialflow";
    const label = body?.label?.trim() || null;

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "MISSING_TENANT_ID" }, { status: 400 });
    }

    await run(
      `INSERT INTO internal_accounts (tenant_id, saas_slug, label)
       VALUES (?, ?, ?)
       ON CONFLICT (tenant_id, saas_slug) DO UPDATE SET label = excluded.label`,
      tenantId,
      saasSlug,
      label,
    );

    return NextResponse.json({ ok: true, tenantId, saasSlug, label });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("INTERNAL_ACCOUNTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireOwnerAccess(req);

    const body = await req.json().catch(() => null) as {
      tenantId?: string;
      saasSlug?: string;
    } | null;

    const tenantId = body?.tenantId?.trim();
    const saasSlug = body?.saasSlug?.trim() || "socialflow";

    if (!tenantId) {
      return NextResponse.json({ ok: false, error: "MISSING_TENANT_ID" }, { status: 400 });
    }

    await run(
      `DELETE FROM internal_accounts WHERE tenant_id = ? AND saas_slug = ?`,
      tenantId,
      saasSlug,
    );

    return NextResponse.json({ ok: true, tenantId, saasSlug });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    console.error("INTERNAL_ACCOUNTS_DELETE_ERROR", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
