export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
function legacySaasResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_SAAS_CREATE_DEPRECATED",
      message: "LEGACY_SAAS_CREATE_BLOCKED: Use /api/factory/provisioning/create-saas or /api/owner/saas-factory/create-saas. /api/saas is permanently disabled.",
    },
    { status: 410 },
  );
}

export async function GET(req: Request) {
  void req;
  return legacySaasResponse();
}

export async function PATCH(req: Request) {
  void req;
  return legacySaasResponse();
}

export async function POST(req: Request) {
  void req;
  return legacySaasResponse();
}
