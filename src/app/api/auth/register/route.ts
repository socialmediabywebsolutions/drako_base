export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

export async function POST(req: Request) {
  const context = resolveAuthsContextFromRequest(req);
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_AUTH_ENDPOINT_DEPRECATED",
      message: "Use /api/drakos/auths/registrations, /api/mentorias/auths/registrations or /api/socialflow/auths/registrations.",
      context,
    },
    { status: 410 },
  );
}
