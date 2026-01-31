import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { applyPackToSaas, getSaasPackById } from "@/lib/packs/repository";
// export const runtime = "edge"; // OpenNext Migration


export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { saasId?: string | null; packId?: string | null } | null;
  if (!body?.saasId || !body.packId) {
    return NextResponse.json({ code: "INVALID_BODY", message: "saasId and packId are required" }, { status: 400 });
  }
  const pack = getSaasPackById(body.packId);
  if (!pack) {
    return NextResponse.json({ code: "NOT_FOUND", message: "Pack not found" }, { status: 404 });
  }
  const { tenantId } = await requireTenantAccess(request);
  const result = await applyPackToSaas({ tenantId, saasId: body.saasId, pack });
  return NextResponse.json({
    appliedFeatures: result.appliedFeatures,
    appliedBlueprintModules: result.appliedBlueprintModules,
    warnings: result.warnings,
  });
}
