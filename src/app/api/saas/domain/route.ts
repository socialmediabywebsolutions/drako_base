import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function legacySaasDomainResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_SAAS_DOMAIN_ROUTE_BLOCKED",
      message: "Use /api/domains/request for domain provisioning. /api/saas/domain is permanently disabled.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return legacySaasDomainResponse();
}

export async function POST() {
  return legacySaasDomainResponse();
}

export async function PATCH() {
  return legacySaasDomainResponse();
}
