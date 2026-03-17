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
  const context = resolveAuthsContextFromRequest(req);
  if (isLegacyAuthBlocked() && context !== "bases") {
    return NextResponse.json(
      {
        ok: false,
        code: "BASE_AUTH_OWNER_ONLY",
        message: "Campamento Base NextAuth is owner-only. Final users must authenticate on the SaaS auth boundary.",
      },
      { status: 410 },
    );
  }
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: any) {
  const context = resolveAuthsContextFromRequest(req);
  if (isLegacyAuthBlocked() && context !== "bases") {
    return NextResponse.json(
      {
        ok: false,
        code: "BASE_AUTH_OWNER_ONLY",
        message: "Campamento Base NextAuth is owner-only. Final users must authenticate on the SaaS auth boundary.",
      },
      { status: 410 },
    );
  }
  return handler(req, ctx);
}
