export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { generateDailyContentBatch } from "@/lib/mentoria/acquisition-content";
import { AcquisitionPublisher } from "@/lib/mentoria/acquisition-publishing";
import { AcquisitionScheduler } from "@/lib/mentoria/acquisition-scheduler";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    
    // Only admins can access acquisition metrics
    if (actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    const publisher = new AcquisitionPublisher();
    const scheduler = new AcquisitionScheduler();

    const metrics = await publisher.getPerformanceMetrics();
    const scheduledPosts = await scheduler.getScheduledPostsForNextDays(7);

    return NextResponse.json({
      ok: true,
      metrics,
      scheduledPosts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ACQUISITION_METRICS_FAILED";
    console.error("[AcquisitionAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    
    // Only admins can manage acquisition
    if (actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    const body = (await request.json()) as {
      action: "generate_daily" | "publish_pending" | "track_click" | "track_signup" | "track_trial";
      postId?: string;
    };

    const scheduler = new AcquisitionScheduler();
    const publisher = new AcquisitionPublisher();

    if (body.action === "generate_daily") {
      const scheduledPosts = await scheduler.generateAndScheduleDailyPosts();
      return NextResponse.json({
        ok: true,
        message: "Daily posts generated and scheduled",
        scheduledPosts,
      });
    }

    if (body.action === "publish_pending") {
      const pendingPosts = await scheduler.getPendingPosts();
      const published = [];

      for (const post of pendingPosts) {
        try {
          // In production, this would integrate with SocialFlow API
          // For now, we mark as published
          await scheduler.markAsPublished(post.id);
          published.push(post);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          await scheduler.markAsFailed(post.id, errorMsg);
        }
      }

      return NextResponse.json({
        ok: true,
        message: `${published.length} posts published`,
        published,
      });
    }

    if (body.action === "track_click" && body.postId) {
      await publisher.trackClick(body.postId, actor.tenantId);
      return NextResponse.json({ ok: true, message: "Click tracked" });
    }

    if (body.action === "track_signup" && body.postId) {
      await publisher.trackSignup(body.postId, actor.tenantId);
      return NextResponse.json({ ok: true, message: "Signup tracked" });
    }

    if (body.action === "track_trial" && body.postId) {
      await publisher.trackTrialStart(body.postId, actor.tenantId);
      return NextResponse.json({ ok: true, message: "Trial start tracked" });
    }

    return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ACQUISITION_ACTION_FAILED";
    console.error("[AcquisitionAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
