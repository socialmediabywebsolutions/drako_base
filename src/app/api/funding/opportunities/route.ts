export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { CronAuthError, verifyCronAuth } from "@/lib/security/cron-auth";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  discardFundingOpportunity,
  insertFundingOpportunities,
  listFundingOpportunities,
  parseFundingInput,
} from "@/lib/drako/funding-repository";

// /api/funding/opportunities — oportunidades del Agente de Financiación (DRACO_DB).
// GET y DELETE: sesión de operator (requireOwnerAccess). POST: Bearer <CRON_SECRET>,
// lo usa drako-scheduler (funding-agent.ts).

function ownerAuthError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
  }
  return null;
}

// GET ?page=1 — 20 por página, más recientes primero.
export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);
    const page = Number(new URL(request.url).searchParams.get("page") ?? "1");
    return NextResponse.json({ ok: true, ...(await listFundingOpportunities(page)) });
  } catch (error) {
    const authResponse = ownerAuthError(error);
    if (authResponse) return authResponse;
    console.error("FUNDING_OPPORTUNITIES_LIST_ERROR", error);
    return NextResponse.json({ ok: false, error: "FUNDING_OPPORTUNITIES_UNAVAILABLE" }, { status: 500 });
  }
}

// POST — body: array de oportunidades. Devuelve cuántas se insertaron (sin duplicados).
export async function POST(request: Request) {
  try {
    verifyCronAuth(request);
  } catch (error) {
    const status = error instanceof CronAuthError ? error.status : 401;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unauthorized" }, { status });
  }

  const items = parseFundingInput(await request.json().catch(() => null));
  if (!items) {
    return NextResponse.json({ ok: false, error: "Body must be an array of { title, organism, ... }" }, { status: 400 });
  }

  try {
    const inserted = await insertFundingOpportunities(items);
    return NextResponse.json({ ok: true, received: items.length, inserted }, { status: 201 });
  } catch (error) {
    console.error("FUNDING_OPPORTUNITIES_INSERT_ERROR", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "FUNDING_INSERT_FAILED" }, { status: 500 });
  }
}

// DELETE ?id=123 (o body { id }) — no borra: marca la oportunidad como 'descartada'.
export async function DELETE(request: Request) {
  try {
    await requireOwnerAccess(request);
    const fromQuery = new URL(request.url).searchParams.get("id");
    const body = fromQuery ? null : ((await request.json().catch(() => null)) as { id?: unknown } | null);
    const id = Number(fromQuery ?? body?.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });
    }
    const updated = await discardFundingOpportunity(id);
    if (!updated) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true, id, status: "descartada" });
  } catch (error) {
    const authResponse = ownerAuthError(error);
    if (authResponse) return authResponse;
    console.error("FUNDING_OPPORTUNITY_DISCARD_ERROR", error);
    return NextResponse.json({ ok: false, error: "FUNDING_DISCARD_FAILED" }, { status: 500 });
  }
}
