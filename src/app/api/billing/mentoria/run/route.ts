export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function POST(_request?: Request) {
  return NextResponse.json(
    {
      ok: false,
      code: "MENTORIA_LEGACY_INVOICER_ROUTE_GONE",
      message: "Legacy manual Mentoria invoicer runtime is removed. Use canonical Stripe webhook and subscription flows.",
    },
    { status: 410 },
  );
}
