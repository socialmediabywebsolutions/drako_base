import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const sourceUrl = new URL(request.url);
  const redirectUrl = new URL("/api/socialflow/linkedin/callback", request.url);
  redirectUrl.search = sourceUrl.search;
  return NextResponse.redirect(redirectUrl, 308);
}
