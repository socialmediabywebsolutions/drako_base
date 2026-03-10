export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getFactoryTrends } from "@/lib/factory/trends";

function parseLimit(url: string): number | undefined {
  const parsed = new URL(url);
  const raw = parsed.searchParams.get("limit");
  if (!raw) return undefined;
  const limit = Number(raw);
  return Number.isFinite(limit) ? limit : undefined;
}

export async function GET(request: Request) {
  try {
    const { tenantId } = await requireOwnerAccess(request);
    const trends = await getFactoryTrends(tenantId, { limit: parseLimit(request.url) });

    return NextResponse.json({
      ok: true,
      trends,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { ok: false, code: error.message, message: error.message },
        { status: error.status },
      );
    }

    console.error("OWNER_FACTORY_TRENDS_ERROR", error);
    return NextResponse.json(
      { ok: false, code: "OWNER_FACTORY_TRENDS_ERROR", message: "Failed to load factory trends" },
      { status: 500 },
    );
  }
}
