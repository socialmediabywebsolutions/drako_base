export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/cf";

// GET - Get analysis status for current user
export async function GET(_req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bindings = env();
    const db = bindings?.DRACO_DB;

    if (!db) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    try {
        const result = await db
            .prepare(`
        SELECT 
          id, status, competitors_found,
          gap_instagram_posts, gap_instagram_likes, gap_engagement,
          opportunities, recommended_departments,
          pdf_url, analysis_completed_at
        FROM competitive_analysis
        WHERE user_email = ?
        ORDER BY created_at DESC
        LIMIT 1
      `)
            .bind(session.user.email)
            .first() as any;

        if (!result) {
            return NextResponse.json({
                status: "not_started",
                message: "No analysis found. Complete onboarding to start analysis.",
            });
        }

        // Parse JSON fields
        const opportunities = result.opportunities ? JSON.parse(result.opportunities as string) : [];
        const departments = result.recommended_departments ? JSON.parse(result.recommended_departments as string) : [];

        // Calculate progress percentage
        let progress = 0;
        if (result.status === 'pending') progress = 0;
        else if (result.status === 'processing') progress = 50;
        else if (result.status === 'completed') progress = 100;
        else if (result.status === 'failed') progress = 0;

        return NextResponse.json({
            status: result.status,
            progress,
            summary: {
                competitors_found: result.competitors_found || 0,
                key_gaps: {
                    instagram_posts: result.gap_instagram_posts,
                    instagram_likes: result.gap_instagram_likes,
                    engagement: result.gap_engagement,
                },
                opportunities_count: opportunities.length,
                recommended_departments_count: departments.length,
            },
            opportunities: opportunities.slice(0, 3), // Top 3
            pdf_url: result.pdf_url,
            completed_at: result.analysis_completed_at,
        });
    } catch (error) {
        console.error("Error fetching analysis status:", error);
        return NextResponse.json(
            { error: "Failed to fetch analysis status", details: String(error) },
            { status: 500 }
        );
    }
}
