export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCloudflareContextSafeSync } from "@/lib/cloudflare/runtime";

export async function GET() {
  try {
    const rawEnv = (getCloudflareContextSafeSync() as { env?: Record<string, unknown> } | null)?.env ?? null;
    const DB = (rawEnv?.SOCIAL_DB ?? null) as D1Database | null;
    if (!DB) {
      return NextResponse.json({ active_clients: 0, published_posts: 0, scheduled_posts: 0 });
    }

    const [clientsRow, publishedRow, scheduledRow] = await Promise.all([
      DB.prepare("SELECT COUNT(DISTINCT tenant_id) AS n FROM saas_social_accounts").first<{ n: number }>(),
      DB.prepare("SELECT COUNT(*) AS n FROM saas_social_posts WHERE status = 'POSTED'").first<{ n: number }>(),
      DB.prepare("SELECT COUNT(*) AS n FROM saas_social_posts WHERE status = 'SCHEDULED'").first<{ n: number }>(),
    ]);

    return NextResponse.json({
      active_clients: clientsRow?.n ?? 0,
      published_posts: publishedRow?.n ?? 0,
      scheduled_posts: scheduledRow?.n ?? 0,
    });
  } catch {
    return NextResponse.json({ active_clients: 0, published_posts: 0, scheduled_posts: 0 });
  }
}
