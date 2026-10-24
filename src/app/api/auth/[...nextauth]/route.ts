export const dynamic = "force-dynamic";

import NextAuth from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { resolveAuthsContextFromRequest } from "@/lib/auths/contexts";

const handler = NextAuth(authOptions);

export async function GET(req: NextRequest, ctx: any) {
  const context = resolveAuthsContextFromRequest(req);
  if (context !== "bases") {
    return NextResponse.json(
      {
        ok: false,
        code: "BASE_OPERATOR_AUTH_ONLY",
        message: "NextAuth and Google OAuth are restricted to the Campamento Base operator surface. Final users must authenticate on the product auth boundary.",
      },
      { status: 403 },
    );
  }
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: any) {
  const context = resolveAuthsContextFromRequest(req);
  if (context !== "bases") {
    return NextResponse.json(
      {
        ok: false,
        code: "BASE_OPERATOR_AUTH_ONLY",
        message: "NextAuth and Google OAuth are restricted to the Campamento Base operator surface. Final users must authenticate on the product auth boundary.",
      },
      { status: 403 },
    );
  }
  return handler(req, ctx);
}
