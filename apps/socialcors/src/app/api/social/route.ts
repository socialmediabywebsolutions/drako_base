import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function legacySocialResponse() {
  return NextResponse.json(
    {
      ok: false,
      code: "LEGACY_SOCIAL_ROUTE_DISABLED",
      message: "Use /api/socialflow/* for SocialFlow runtime APIs. /api/social/* is permanently disabled.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return legacySocialResponse();
}

export async function POST() {
  return legacySocialResponse();
}

export async function PATCH() {
  return legacySocialResponse();
}

export async function PUT() {
  return legacySocialResponse();
}

export async function DELETE() {
  return legacySocialResponse();
}
