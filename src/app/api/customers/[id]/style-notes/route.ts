import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import {
  addCustomerStyleNote,
  listCustomerStyleNotes,
  resolveCustomersContext,
  CustomersContextError,
} from "@/lib/customers/repository";
export const runtime = "edge";


type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    const { id: customerId } = await params;
    if (!saasId || !customerId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId and customerId are required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId });
    const items = await listCustomerStyleNotes(ctx, customerId);
    return NextResponse.json({ items, count: items.length });
  } catch (error) {
    if (error instanceof CustomersContextError) {
      return NextResponse.json({ code: "INVALID_CUSTOMERS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("CUSTOMER_STYLE_NOTES_LIST_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudieron cargar las notas" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const body = (await request.json().catch(() => null)) as {
      saasId?: string | null;
      noteType?: string;
      content?: string;
      source?: string;
    } | null;
    const { id: customerId } = await params;
    if (!body?.saasId || !customerId || !body.noteType || !body.content) {
      return NextResponse.json(
        { code: "INVALID_BODY", message: "saasId, noteType and content are required" },
        { status: 400 },
      );
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId: body.saasId });
    const note = await addCustomerStyleNote(ctx, {
      customerId,
      saasId: body.saasId,
      noteType: body.noteType,
      content: body.content,
      source: body.source ?? "EMPLOYEE",
    });
    return NextResponse.json({ note });
  } catch (error) {
    if (error instanceof CustomersContextError) {
      return NextResponse.json({ code: "INVALID_CUSTOMERS_CONTEXT", message: error.message }, { status: 400 });
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("CUSTOMER_STYLE_NOTES_CREATE_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo guardar la nota" }, { status: 500 });
  }
}
