import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleEconomyApiError } from "@/lib/economy/api-helpers";
import { listSaasExpenses, resolveEconomyContext, upsertSaasExpense } from "@/lib/economy/repository";
import type { SaasExpense } from "@/lib/economy/types";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId });
    const items = await listSaasExpenses(context);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_EXPENSES_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string;
      type?: SaasExpense["type"];
      label?: string;
      amount?: number;
      currency?: string;
      period?: SaasExpense["period"];
      fromDate?: string;
      toDate?: string | null;
      source?: SaasExpense["source"] | null;
      metadata?: Record<string, unknown> | null;
    } | null;
    if (
      !body?.saasId ||
      !body.type ||
      !body.label ||
      typeof body.amount !== "number" ||
      !body.period ||
      !body.fromDate
    ) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, type, label, amount, period, and fromDate are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveEconomyContext({ tenantId, saasId: body.saasId });
    const expense = await upsertSaasExpense(context, {
      id: body.id,
      saasId: body.saasId,
      type: body.type,
      label: body.label,
      amount: body.amount,
      currency: body.currency ?? "EUR",
      period: body.period,
      fromDate: body.fromDate,
      toDate: typeof body.toDate === "undefined" ? null : body.toDate,
      source: body.source ?? null,
      metadata: body.metadata ?? null,
    });
    return NextResponse.json({ expense });
  } catch (error) {
    return handleEconomyApiError("ECONOMY_EXPENSES_POST", error);
  }
}
