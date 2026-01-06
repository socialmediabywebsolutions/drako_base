import { NextResponse } from "next/server";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";
import { queryAll } from "@/lib/db";
import { getDemoOwner } from "@/lib/admin/demo-data";
import { deleteVendorExpense, resolveVendorExpensesContext } from "@/lib/owner/vendor-expenses";


type OwnerRow = {
  id: string;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function resolveOwnerId(tenantId: string, ownerIdParam: string | null): Promise<string | null> {
  if (ownerIdParam) return ownerIdParam;
  const rows = await queryAll<OwnerRow>("SELECT id FROM owners WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1", tenantId);
  if (rows[0]?.id) return rows[0].id;
  return getDemoOwner(tenantId)?.id ?? null;
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const { tenantId } = await requireTenantAccess(request);
    const url = new URL(request.url);
    const ownerId = await resolveOwnerId(tenantId, url.searchParams.get("ownerId"));
    if (!ownerId) {
      return NextResponse.json({ code: "OWNER_NOT_FOUND", message: "No owner found for tenant" }, { status: 404 });
    }
    const { id } = await params;
    if (!id || !id.trim()) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "id is required" }, { status: 400 });
    }
    const ctx = await resolveVendorExpensesContext({ tenantId });
    await deleteVendorExpense(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ code: "UNAUTHORIZED", message: error.message }, { status: error.status });
    }
    console.error("OWNER_VENDOR_EXPENSES_DELETE_ERROR", error);
    return NextResponse.json({ code: "OWNER_VENDOR_EXPENSES_DELETE_ERROR", message: "No se pudo borrar el gasto del vendor" }, { status: 500 });
  }
}
