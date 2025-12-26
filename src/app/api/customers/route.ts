import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import {
  findCustomerByContact,
  listSaasCustomers,
  resolveCustomersContext,
  upsertSaasCustomer,
  upsertSaasCustomerProfile,
} from "@/lib/customers/repository";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const search = url.searchParams.get("search");
    const isVipParam = url.searchParams.get("isVip");
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "50");

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId });
    const items = await listSaasCustomers(ctx, {
      search,
      isVip: isVipParam === null ? undefined : isVipParam === "1" || isVipParam.toLowerCase() === "true",
    });
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 50;
    const start = (safePage - 1) * safePageSize;
    const paginated = items.slice(start, start + safePageSize);

    return NextResponse.json({ items: paginated, count: items.length, page: safePage, pageSize: safePageSize });
  } catch (error) {
    console.error("CUSTOMERS_LIST_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo listar clientes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      id?: string;
      saasId?: string | null;
      fullName?: string;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
      preferredEmployeeId?: string | null;
      preferredServices?: string[] | null;
      styleProfile?: Record<string, unknown> | null;
      isVip?: boolean;
      vipLevel?: "REGULAR" | "VIP" | "VVIP";
      profile?: {
        tags?: string[] | null;
        preferences?: Record<string, unknown> | null;
        birthday?: string | null;
        styleProfile?: Record<string, unknown> | null;
        lastStyleReviewAt?: string | null;
        metadata?: Record<string, unknown> | null;
      };
    } | null;

    if (!body?.saasId || !body.fullName?.trim()) {
      return NextResponse.json({ code: "INVALID_BODY", message: "saasId and fullName are required" }, { status: 400 });
    }

    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveCustomersContext({ tenantId, saasId: body.saasId });

    let customerId = body.id?.trim() ?? null;
    if (!customerId && (body.email?.trim() || body.phone?.trim())) {
      const existing = await findCustomerByContact(ctx, { email: body.email, phone: body.phone });
      if (existing) {
        customerId = existing.id;
      }
    }

    const customer = await upsertSaasCustomer(ctx, {
      id: customerId ?? undefined,
      saasId: body.saasId,
      fullName: body.fullName.trim(),
      email: body.email?.trim() ?? null,
      phone: body.phone?.trim() ?? null,
      notes: body.notes?.trim() ?? null,
      preferredEmployeeId: body.preferredEmployeeId ?? null,
      preferredServices: body.preferredServices ?? null,
      styleProfile: body.styleProfile ?? null,
      isVip: body.isVip,
      vipLevel: body.vipLevel ?? null,
    });

    let profile = null;
    if (body.profile) {
      profile = await upsertSaasCustomerProfile(ctx, {
        customerId: customer.id,
        saasId: body.saasId,
        tags: body.profile.tags ?? null,
        preferences: body.profile.preferences ?? null,
        birthday: body.profile.birthday ?? null,
        styleProfile: body.profile.styleProfile ?? null,
        lastStyleReviewAt: body.profile.lastStyleReviewAt ?? null,
        metadata: body.profile.metadata ?? null,
      });
    }

    return NextResponse.json({ customer, profile });
  } catch (error) {
    console.error("CUSTOMERS_UPSERT_ERROR", error);
    return NextResponse.json({ code: "CUSTOMERS_ERROR", message: "No se pudo guardar el cliente" }, { status: 500 });
  }
}
