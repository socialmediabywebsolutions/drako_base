import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function legacySaasResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_SAAS_ROUTE_DISABLED",
      message: "Use /api/operator/* for control APIs and /api/factory/* for provisioning. /api/saas/* is permanently disabled.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return legacySaasResponse();
}

export async function POST() {
  return legacySaasResponse();
}

export async function PATCH() {
  return legacySaasResponse();
}

export async function PUT() {
  return legacySaasResponse();
}

export async function DELETE() {
  return legacySaasResponse();
}
