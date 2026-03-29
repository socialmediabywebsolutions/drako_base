export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireCurrentMentoriaSession } from "@/lib/mentoria/auth/request";
import { UserAnalytics } from "@/lib/mentoria/user-analytics";
import { FeedbackSystem } from "@/lib/mentoria/feedback-system";
import { OptimizationEngine } from "@/lib/mentoria/optimization-engine";

export async function GET(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);

    // Only admins can access analytics
    if (actor.role !== "admin") {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 403 });
    }

    const optimizationEngine = new OptimizationEngine();
    const report = await optimizationEngine.generateOptimizationReport();

    return NextResponse.json({
      ok: true,
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ANALYTICS_FAILED";
    console.error("[AnalyticsAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentMentoriaSession(request);
    const body = (await request.json()) as {
      action: "record_first_session" | "record_session_completed" | "record_conversion" | "collect_feedback";
      studentProfileId?: string;
      sessionCount?: number;
      liked?: string[];
      missing?: string[];
      wouldRecommend?: boolean;
    };

    const userAnalytics = new UserAnalytics();
    const feedbackSystem = new FeedbackSystem();

    if (body.action === "record_first_session" && body.studentProfileId) {
      await userAnalytics.recordFirstSession(actor.tenantId, body.studentProfileId);
      return NextResponse.json({ ok: true, message: "First session recorded" });
    }

    if (body.action === "record_session_completed" && body.studentProfileId) {
      await userAnalytics.recordSessionCompleted(actor.tenantId, body.studentProfileId);
      return NextResponse.json({ ok: true, message: "Session completion recorded" });
    }

    if (body.action === "record_conversion" && body.studentProfileId) {
      await userAnalytics.recordTrialConversion(actor.tenantId, body.studentProfileId);
      return NextResponse.json({ ok: true, message: "Trial conversion recorded" });
    }

    if (
      body.action === "collect_feedback" &&
      body.studentProfileId &&
      body.sessionCount !== undefined &&
      body.liked &&
      body.missing &&
      body.wouldRecommend !== undefined
    ) {
      await feedbackSystem.collectFeedback({
        tenantId: actor.tenantId,
        studentProfileId: body.studentProfileId,
        sessionCount: body.sessionCount,
        liked: body.liked,
        missing: body.missing,
        wouldRecommend: body.wouldRecommend,
      });
      return NextResponse.json({ ok: true, message: "Feedback collected" });
    }

    return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ANALYTICS_ACTION_FAILED";
    console.error("[AnalyticsAPI] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
