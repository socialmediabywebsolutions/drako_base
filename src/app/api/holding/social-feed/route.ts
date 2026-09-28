export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { listHoldingSocialFeed } from "@/lib/revista/repository";

export async function GET() {
  try {
    const posts = await listHoldingSocialFeed({ limit: 50 });
    return NextResponse.json({ posts });
  } catch (error) {
    console.error("[holding/social-feed] Error", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        error: "Failed to fetch social feed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
