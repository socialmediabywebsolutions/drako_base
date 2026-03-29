export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function PATCH(
  _request?: Request,
  context?: { params: Promise<{ id: string }> },
) {
  if (context?.params) {
    await context.params;
  }
  return NextResponse.json(
    {
      ok: false,
      code: "MENTORIA_LEGACY_SESSION_COMPLETE_ROUTE_GONE",
      message: "Legacy session completion runtime is removed. Use the canonical Mentoria session flow.",
    },
    { status: 410 },
  );
}
