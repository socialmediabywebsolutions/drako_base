import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LEGACY_LINKEDIN_PUBLISH_DISABLED = {
  ok: false,
  error: "LEGACY_SOCIAL_ROUTE_DISABLED",
  canonical: "/api/socialflow/posts",
};

function legacyLinkedInPublishResponse() {
  return NextResponse.json(LEGACY_LINKEDIN_PUBLISH_DISABLED, { status: 410 });
}

export async function POST() {
  return legacyLinkedInPublishResponse();
}

export async function GET() {
  return legacyLinkedInPublishResponse();
}

export async function PUT() {
  return legacyLinkedInPublishResponse();
}

export async function PATCH() {
  return legacyLinkedInPublishResponse();
}

export async function DELETE() {
  return legacyLinkedInPublishResponse();
}
