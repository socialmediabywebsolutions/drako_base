export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

export async function POST(req: Request) {
  const context = resolveAuthsContextFromRequest(req);
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_AUTH_ENDPOINT_DEPRECATED",
      message: "Use /api/drakos/auths/logins, /api/mentorias/auths/logins, /api/socialflow/auths/logins or /bases/login for holding access.",
      context,
    },
    { status: 410 },
  );
}
