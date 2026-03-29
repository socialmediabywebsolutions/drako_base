export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    {
      ok: false,
      code: "MENTORIA_LEGACY_SESSION_BILL_ROUTE_GONE",
      message: "Legacy session billing runtime is removed. Billing is handled through canonical Mentoria subscription flows.",
    },
    { status: 410 },
  );
}
