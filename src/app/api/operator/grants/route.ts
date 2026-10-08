export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { queryAll, run } from "@/lib/db";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type GrantStatus =
  | "IDENTIFIED"
  | "EVALUATING"
  | "APPLYING"
  | "SUBMITTED"
  | "APPROVED"
  | "DENIED"
  | "WITHDRAWN";

export type GrantType = "GRANT" | "LOAN" | "SUBSIDY" | "ADVANCE";

export type OperatorGrant = {
  id: string;
  tenant_id: string;
  name: string;
  entity: string;
  description: string | null;
  program: string | null;
  url: string | null;
  max_amount: number | null;
  grant_type: GrantType;
  deadline: string | null;
  applied_at: string | null;
  outcome_at: string | null;
  status: GrantStatus;
  requirements: string | null;
  documents_generated: string | null;
  notes: string | null;
  ai_summary: string | null;
  ai_fit_score: number | null;
  created_at: string;
  updated_at: string;
};

const GRANT_FIELDS = `
  id, tenant_id, name, entity, description, program, url,
  max_amount, grant_type, deadline, applied_at, outcome_at, status,
  requirements, documents_generated, notes, ai_summary, ai_fit_score,
  created_at, updated_at
`.trim();

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function authError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

// ─── GET — listar / filtrar ───────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const status = url.searchParams.get("status");

    if (id) {
      const rows = await queryAll<OperatorGrant>(
        `SELECT ${GRANT_FIELDS} FROM operator_grants WHERE id = ? AND tenant_id = ? LIMIT 1`,
        id, tenantId
      );
      return NextResponse.json({ ok: true, item: rows[0] ?? null });
    }

    let query = `SELECT ${GRANT_FIELDS} FROM operator_grants WHERE tenant_id = ?`;
    const params: (string | number)[] = [tenantId];
    if (status) { query += " AND status = ?"; params.push(status); }
    query += " ORDER BY created_at DESC";

    const items = await queryAll<OperatorGrant>(query, ...params);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error("GRANTS_GET_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

// ─── POST — crear ayuda ───────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<OperatorGrant> | null;

    if (!body?.name?.trim()) return errorResponse("name is required");
    if (!body?.entity?.trim()) return errorResponse("entity is required");

    const id = `grant_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();

    const ok = await run(
      `INSERT INTO operator_grants (
        id, tenant_id, name, entity, description, program, url,
        max_amount, grant_type, deadline, applied_at, outcome_at, status,
        requirements, documents_generated, notes, ai_summary, ai_fit_score,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, tenantId,
      body.name.trim(),
      body.entity.trim(),
      body.description ?? null,
      body.program ?? null,
      body.url ?? null,
      body.max_amount ?? null,
      body.grant_type ?? "GRANT",
      body.deadline ?? null,
      body.applied_at ?? null,
      body.outcome_at ?? null,
      body.status ?? "IDENTIFIED",
      body.requirements ?? null,
      body.documents_generated ?? null,
      body.notes ?? null,
      body.ai_summary ?? null,
      body.ai_fit_score ?? null,
      now, now
    );

    if (!ok) return NextResponse.json({ ok: false, error: "Failed to create grant" }, { status: 500 });

    const rows = await queryAll<OperatorGrant>(
      `SELECT ${GRANT_FIELDS} FROM operator_grants WHERE id = ? AND tenant_id = ?`,
      id, tenantId
    );
    return NextResponse.json({ ok: true, item: rows[0] ?? null });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error("GRANTS_POST_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

// ─── PATCH — actualizar estado / campos ──────────────────────────────────────

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(req);
    const body = (await req.json().catch(() => null)) as Partial<OperatorGrant> | null;
    if (!body?.id) return errorResponse("id is required");

    const updatable: (keyof OperatorGrant)[] = [
      "name", "entity", "description", "program", "url",
      "max_amount", "grant_type", "deadline", "applied_at", "outcome_at", "status",
      "requirements", "documents_generated", "notes", "ai_summary", "ai_fit_score",
    ];
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    for (const key of updatable) {
      if (typeof body[key] !== "undefined") {
        fields.push(`${key} = ?`);
        values.push((body[key] as string | number | null) ?? null);
      }
    }
    if (fields.length === 0) return errorResponse("no fields to update");

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(body.id, tenantId);

    const ok = await run(
      `UPDATE operator_grants SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
      ...values
    );
    if (!ok) return NextResponse.json({ ok: false, error: "Failed to update grant" }, { status: 500 });

    const rows = await queryAll<OperatorGrant>(
      `SELECT ${GRANT_FIELDS} FROM operator_grants WHERE id = ? AND tenant_id = ?`,
      body.id, tenantId
    );
    return NextResponse.json({ ok: true, item: rows[0] ?? null });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error("GRANTS_PATCH_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}

// ─── DELETE — eliminar ────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(req);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return errorResponse("id is required");

    const ok = await run(
      `DELETE FROM operator_grants WHERE id = ? AND tenant_id = ?`,
      id, tenantId
    );
    if (!ok) return NextResponse.json({ ok: false, error: "Failed to delete grant" }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const r = authError(error);
    if (r) return r;
    console.error("GRANTS_DELETE_ERROR", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
