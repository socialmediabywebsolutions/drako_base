import { NextResponse } from "next/server";

// Legacy draft endpoint kept as an explicit no-op.
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Billing portal draft endpoint is deprecated. Use /api/billing/portal.",
    },
    { status: 410 },
  );
}
