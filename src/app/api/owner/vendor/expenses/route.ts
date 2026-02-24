export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { listVendorExpenses, resolveVendorExpensesContext, upsertVendorExpense } from "@/lib/owner/vendor-expenses";
import type { DrakoVendorExpenseFilters, DrakoVendorExpenseInput, DrakoVendorExpensePeriod, DrakoVendorExpenseType } from "@/lib/owner/vendor-types";


type OwnerRow = {
  id: string;
};

const PERIODS: DrakoVendorExpensePeriod[] = ["MONTHLY", "YEARLY", "ONE_OFF"];
const TYPES: DrakoVendorExpenseType[] = ["INFRA", "AI", "MARKETING", "SUPPORT", "TEAM", "OTHER"];

async function resolveOwnerId(tenantId: string, ownerIdParam: string | null): Promise<string | null> {
  if (ownerIdParam) return ownerIdParam;
  const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
  if (rows[0]?.id) return rows[0].id;
  return getDemoOwner(tenantId)?.id ?? null;
}

function parseFilters(url: URL): DrakoVendorExpenseFilters {
  const filters: DrakoVendorExpenseFilters = {};
  const period = url.searchParams.get("period");
  if (period && PERIODS.includes(period as DrakoVendorExpensePeriod)) {
    filters.period = period as DrakoVendorExpensePeriod;
  }
  const type = url.searchParams.get("type");
  if (type && TYPES.includes(type as DrakoVendorExpenseType)) {
    filters.type = type as DrakoVendorExpenseType;
  }
  const verticalId = url.searchParams.get("verticalId");
  if (verticalId !== null && verticalId.trim() !== "") {
    filters.verticalId = verticalId.trim();
  }
  const from = url.searchParams.get("from");
  if (from && from.trim() !== "") {
    filters.from = from.trim();
  }
  const to = url.searchParams.get("to");
  if (to && to.trim() !== "") {
    filters.to = to.trim();
  }
  return filters;
}

function validateInput(input: DrakoVendorExpenseInput): string | null {
  if (!input.label?.trim()) return "label is required";
  if (!TYPES.includes(input.type)) return "type is invalid";
  if (!PERIODS.includes(input.period)) return "period is invalid";
  if (typeof input.amount !== "number" || Number.isNaN(input.amount) || input.amount <= 0) return "amount must be greater than 0";
  if (!input.currency?.trim()) return "currency is required";
  if (!input.fromDate?.trim()) return "fromDate is required";
  return null;
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const ownerId = await resolveOwnerId(tenantId, url.searchParams.get("ownerId"));
    if (!ownerId) {
      return NextResponse.json({ code: "OWNER_NOT_FOUND", message: "No owner found for tenant" }, { status: 404 });
    }

    const filters = parseFilters(url);
    const ctx = await resolveVendorExpensesContext({ tenantId });
    const items = await listVendorExpenses(ctx, filters);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_VENDOR_EXPENSES_LIST_ERROR", error);
    return NextResponse.json({ code: "OWNER_VENDOR_EXPENSES_LIST_ERROR", message: "No se pudieron listar los gastos del vendor" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const ownerId = await resolveOwnerId(tenantId, url.searchParams.get("ownerId"));
    if (!ownerId) {
      return NextResponse.json({ code: "OWNER_NOT_FOUND", message: "No owner found for tenant" }, { status: 404 });
    }
    const body = (await request.json().catch(() => null)) as DrakoVendorExpenseInput | null;
    if (!body) {
      return NextResponse.json({ code: "INVALID_BODY", message: "Body is required" }, { status: 400 });
    }
    const validationError = validateInput(body);
    if (validationError) {
      return NextResponse.json({ code: "INVALID_BODY", message: validationError }, { status: 400 });
    }

    const ctx = await resolveVendorExpensesContext({ tenantId });
    const expense = await upsertVendorExpense(ctx, {
      id: body.id,
      label: body.label.trim(),
      type: body.type,
      amount: body.amount,
      currency: body.currency.trim(),
      period: body.period,
      fromDate: body.fromDate.trim(),
      toDate: body.toDate ?? null,
      verticalId: body.verticalId ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json({ expense });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_VENDOR_EXPENSES_UPSERT_ERROR", error);
    return NextResponse.json({ code: "OWNER_VENDOR_EXPENSES_UPSERT_ERROR", message: "No se pudo guardar el gasto del vendor" }, { status: 500 });
  }
}
