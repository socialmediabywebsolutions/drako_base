export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getFactoryStatus } from "@/lib/factory/status";

export async function GET(request: Request) {
  try {
    const access = await requireOwnerAccess(request);
    if (!access?.tenantId) {
      throw new UnauthorizedError("SESSION_REQUIRED", 401);
    }
    const { tenantId } = access;
    const factory = await getFactoryStatus(tenantId);

    return NextResponse.json({
      ok: true,
      factory,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, code: error.message, message: error.message },
        { status: error.status },
      );
    }

    console.error("OWNER_FACTORY_STATUS_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "OWNER_FACTORY_STATUS_ERROR", message: "Failed to load factory status" },
      { status: 500 },
    );
  }
}
