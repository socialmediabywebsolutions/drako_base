import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const LEGACY_SOCIAL_ROUTE_DISABLED = {
  ok: false,
  error: "LEGACY_SOCIAL_ROUTE_DISABLED",
  canonical: "/api/socialflow/posts",
};

function legacySocialPostsResponse() {
  return NextResponse.json(LEGACY_SOCIAL_ROUTE_DISABLED, { status: 410 });
}

export async function GET() {
  return legacySocialPostsResponse();
}

export async function POST() {
  return legacySocialPostsResponse();
}

export async function PATCH() {
  return legacySocialPostsResponse();
}

export async function PUT() {
  return legacySocialPostsResponse();
}

export async function DELETE() {
  return legacySocialPostsResponse();
}
