import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { resolveClinicContext } from "@/lib/clinic/context";
import { handleClinicApiError } from "@/lib/clinic/api-helpers";
import { addClinicFinanceEntry, listClinicFinanceEntries, summarizeFinance } from "@/lib/clinic/repository";


export async function GET(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const items = await listClinicFinanceEntries(context);
    const summary = summarizeFinance(items);
    return NextResponse.json({ items, summary });
  } catch (error) {
    return handleClinicApiError("FINANCE_GET", error);
  }
}

export async function POST(request: Request) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const context = await resolveClinicContext(tenantId);
    const body = (await request.json().catch(() => null)) as {
      serviceName?: string | null;
      amount?: number;
      paidAt?: string;
      appointmentId?: string | null;
      method?: string | null;
    } | null;
    if (!body || typeof body.amount !== "number" || !body.paidAt) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "amount and paidAt are required" },
        { status: 400 },
      );
    }
    const entry = await addClinicFinanceEntry(context, {
      saasId: context.saasId,
      serviceName: typeof body.serviceName === "string" ? body.serviceName : null,
      amount: body.amount,
      paidAt: body.paidAt,
      appointmentId: typeof body.appointmentId === "string" ? body.appointmentId : null,
      method: typeof body.method === "string" ? body.method : "card",
    });
    return NextResponse.json({ entry });
  } catch (error) {
    return handleClinicApiError("FINANCE_POST", error);
  }
}
