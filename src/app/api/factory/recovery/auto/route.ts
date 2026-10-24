export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getFactoryRecoveryCandidates } from "@/lib/factory/recovery";

function parseLimit(url: string): number | undefined {
  const parsed = new URL(url);
  const raw = parsed.searchParams.get("limit");
  if (!raw) return undefined;
  const limit = Number(raw);
  return Number.isFinite(limit) ? limit : undefined;
}

export async function GET(request: Request) {
  try {
    const access = await requireOwnerAccess(request);
    if (!access?.tenantId) {
      throw new UnauthorizedError("SESSION_REQUIRED", 401);
    }
    const { tenantId } = access;
    const recoveryCandidates = await getFactoryRecoveryCandidates(tenantId, {
      limit: parseLimit(request.url),
    });

    return NextResponse.json({
      ok: true,
      recoveryCandidates,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, code: error.message, message: error.message },
        { status: error.status },
      );
    }

    console.error("OWNER_FACTORY_AUTO_RECOVERY_ERROR", error);
    return NextResponse.json(
      {
        ok: false,
        code: "OWNER_FACTORY_AUTO_RECOVERY_ERROR",
        message: "Failed to load factory auto recovery candidates",
      },
      { status: 500 },
    );
  }
}
