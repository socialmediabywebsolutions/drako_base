import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/auth/session";
import { handleBlueprintsApiError } from "@/lib/blueprints/api-helpers";
import { listSaasModules, resolveBlueprintsContext } from "@/lib/blueprints/repository";
// export const runtime = "edge"; // OpenNext Migration


export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const saasId = url.searchParams.get("saasId");
    if (!saasId) {
      return NextResponse.json({ code: "INVALID_PARAMS", message: "saasId is required" }, { status: 400 });
    }
    const { tenantId } = await requireTenantAccess(request);
    const ctx = await resolveBlueprintsContext({ tenantId, saasId });
    const modules = await listSaasModules(ctx, saasId);
    return NextResponse.json({ modules });
  } catch (error) {
    return handleBlueprintsApiError("BLUEPRINT_MODULES_GET", error, "BLUEPRINT_MODULES_ERROR");
  }
}
