export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
function legacyClientSaasResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_CLIENT_SAAS_ROUTE_DISABLED",
      message: "Client-to-SaaS linking is no longer exposed through /api/client-saas.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return legacyClientSaasResponse();
}

export async function POST() {
  return legacyClientSaasResponse();
}

export async function PATCH() {
  return legacyClientSaasResponse();
}

export async function DELETE() {
  return legacyClientSaasResponse();
}
