
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { processScheduledPosts } from "@/lib/social/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "Database not available" }, { status: 500 });
  }

  const testId = `test_post_${Date.now()}`;
  const tenantId = "test_tenant";
  const saasId = "test_saas";
  const now = new Date();
  const past = new Date(now.getTime() - 1000 * 60 * 60).toISOString(); // 1 hour ago

  try {
    // 1. Insert Test Post
    await db.prepare(`
      INSERT INTO saas_social_posts (
        id, tenant_id, saas_id, provider, content_type, title, body, status, scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      testId, tenantId, saasId, "LINKEDIN", "FEED", "Test Post", "This is a test", 
      "SCHEDULED", past, now.toISOString(), now.toISOString()
    ).run();

    // 2. Run Scheduler
    const logs = await processScheduledPosts();

    // 3. Verify
    const post = await db.prepare("SELECT status, posted_at FROM saas_social_posts WHERE id = ?").bind(testId).first<{ status: string; posted_at: string }>();

    // 4. Cleanup
    await db.prepare("DELETE FROM saas_social_posts WHERE id = ?").bind(testId).run();

    if (post?.status === "PUBLISHED" && post.posted_at) {
      return NextResponse.json({ 
        success: true, 
        message: "Test post successfully published by scheduler", 
        post,
        logs 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        message: "Test post failed to publish", 
        post, 
        logs 
      }, { status: 500 });
    }

  } catch (error) {
    // Cleanup on error
    try { await db.prepare("DELETE FROM saas_social_posts WHERE id = ?").bind(testId).run(); } catch {}
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
