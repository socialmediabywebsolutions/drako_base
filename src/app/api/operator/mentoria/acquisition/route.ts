export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { requireOwnerAccess, UnauthorizedError } from "@/lib/auth/session";
import { getDb } from "@/lib/mentoria/db";

type AcquisitionPostRow = {
  id: string;
  tenant_id: string;
  post_id: string;
  channel: string;
  content: string;
  published_at: string;
  external_id: string | null;
  clicks: number;
  signups: number;
  trial_starts: number;
  created_at: string;
};

type ScheduledPostRow = {
  id: string;
  tenant_id: string;
  post_id: string;
  channel: string;
  content: string;
  scheduled_for: string;
  status: string;
  published_at: string | null;
  error: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    await requireOwnerAccess(request);

    const db = getDb();

    // Aggregate metrics across all tenants
    let metrics = { totalPosts: 0, totalClicks: 0, totalSignups: 0, totalTrialStarts: 0 };
    let recentPosts: AcquisitionPostRow[] = [];
    let scheduledPosts: ScheduledPostRow[] = [];

    try {
      const agg = await db
        .prepare(
          `SELECT
             COUNT(*) AS total_posts,
             COALESCE(SUM(clicks), 0) AS total_clicks,
             COALESCE(SUM(signups), 0) AS total_signups,
             COALESCE(SUM(trial_starts), 0) AS total_trial_starts
           FROM acquisition_posts`
        )
        .first<{ total_posts: number; total_clicks: number; total_signups: number; total_trial_starts: number }>();

      if (agg) {
        metrics = {
          totalPosts: agg.total_posts,
          totalClicks: agg.total_clicks,
          totalSignups: agg.total_signups,
          totalTrialStarts: agg.total_trial_starts,
        };
      }

      recentPosts = (
        await db
          .prepare(
            `SELECT id, tenant_id, post_id, channel, content, published_at, external_id, clicks, signups, trial_starts, created_at
             FROM acquisition_posts
             ORDER BY published_at DESC
             LIMIT 20`
          )
          .all<AcquisitionPostRow>()
      ).results;

      scheduledPosts = (
        await db
          .prepare(
            `SELECT id, tenant_id, post_id, channel, content, scheduled_for, status, published_at, error, created_at
             FROM scheduled_posts
             WHERE status = 'pending'
             ORDER BY scheduled_for ASC
             LIMIT 20`
          )
          .all<ScheduledPostRow>()
      ).results;
    } catch {
      // Tables may not exist yet (migration pending) — return empty gracefully
    }

    const conversionRate =
      metrics.totalClicks > 0 ? ((metrics.totalSignups / metrics.totalClicks) * 100).toFixed(1) : "0.0";

    // Channel breakdown
    const byChannel: Record<string, { posts: number; clicks: number; signups: number }> = {};
    for (const p of recentPosts) {
      const ch = p.channel;
      if (!byChannel[ch]) byChannel[ch] = { posts: 0, clicks: 0, signups: 0 };
      byChannel[ch].posts += 1;
      byChannel[ch].clicks += p.clicks;
      byChannel[ch].signups += p.signups;
    }

    return NextResponse.json({
      ok: true,
      metrics: { ...metrics, conversionRate },
      byChannel,
      recentPosts: recentPosts.map((p) => ({
        id: p.id,
        tenantId: p.tenant_id,
        channel: p.channel,
        content: p.content.slice(0, 200),
        publishedAt: p.published_at,
        externalId: p.external_id,
        clicks: p.clicks,
        signups: p.signups,
        trialStarts: p.trial_starts,
      })),
      scheduledPosts: scheduledPosts.map((p) => ({
        id: p.id,
        channel: p.channel,
        content: p.content.slice(0, 200),
        scheduledFor: p.scheduled_for,
        status: p.status,
      })),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "ACQUISITION_METRICS_FAILED";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
