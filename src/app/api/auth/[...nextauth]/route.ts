export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isAuthsIsolationEnabled, isAuthsLegacyCompatEnabled } from "@/lib/auths/flags";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

const handler = NextAuth(authOptions);

function isLegacyAuthBlocked() {
  return isAuthsIsolationEnabled() && !isAuthsLegacyCompatEnabled();
}

export async function GET(req: NextRequest, ctx: any) {
  if (isAuthsIsolationEnabled() && resolveAuthsContextFromRequest(req) === "bases") {
    return NextResponse.json(
      { ok: false, code: "BASES_FINAL_USER_AUTH_DISABLED", message: "Campamento Base does not expose final-user auth." },
      { status: 403 },
    );
  }
  if (isLegacyAuthBlocked()) {
    return NextResponse.json(
      { ok: false, code: "AUTHS_LEGACY_COMPATS_DISABLED", message: "Legacy next-auth endpoint is disabled." },
      { status: 410 },
    );
  }
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: any) {
  if (isAuthsIsolationEnabled() && resolveAuthsContextFromRequest(req) === "bases") {
    return NextResponse.json(
      { ok: false, code: "BASES_FINAL_USER_AUTH_DISABLED", message: "Campamento Base does not expose final-user auth." },
      { status: 403 },
    );
  }
  if (isLegacyAuthBlocked()) {
    return NextResponse.json(
      { ok: false, code: "AUTHS_LEGACY_COMPATS_DISABLED", message: "Legacy next-auth endpoint is disabled." },
      { status: 410 },
    );
  }
  return handler(req, ctx);
}
