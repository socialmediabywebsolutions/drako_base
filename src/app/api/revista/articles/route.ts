export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { listRevistaArticles } from "@/lib/revista/repository";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const saasId = url.searchParams.get("saasId") ?? undefined;

  try {
    const articles = await listRevistaArticles({ limit, offset, saasId });
    return NextResponse.json({ articles });
  } catch (error) {
    console.error("[revista/articles] Error", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: "Failed to fetch articles",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
