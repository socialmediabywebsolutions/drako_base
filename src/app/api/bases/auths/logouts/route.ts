export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: false,
    code: "BASES_CUSTOM_AUTHS_DEPRECATED",
    message: "Campo Base operator auth now uses NextAuth + D1 only. Sign out through NextAuth.",
  }, { status: 410 });
}
