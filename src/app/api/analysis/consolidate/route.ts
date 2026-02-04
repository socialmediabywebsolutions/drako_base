import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/cf";

// POST - Consolidate all analysis data and generate insights
export async function POST(req: NextRequest) {
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
        const body = await req.json() as {
            geo_data: any;
            client_social: any;
            competitor_social: any;
            web_data: any;
        };
        const {
            geo_data,           // From Geo-Agent
            client_social,      // From Client-Social-Agent
            competitor_social,  // From Competitor-Social-Agent
            web_data,          // From Web-Agent
        } = body;

        // Calculate gaps (client vs competitor averages)
        const gaps = calculateGaps(client_social, competitor_social, web_data);

        // Identify strengths and weaknesses
        const { strengths, weaknesses } = identifyStrengthsWeaknesses(gaps);

        // Generate opportunities
        const opportunities = generateOpportunities(gaps, weaknesses);

        // Recommend Drako departments
        const recommended_departments = recommendDepartments(opportunities, gaps);

        // Calculate totals and projections
        const totalMonthlyInvestment = recommended_departments.reduce(
            (sum: number, dept: any) => sum + (dept.price_monthly || 0),
            0
        );

        const avgROI = recommended_departments.reduce(
            (sum: number, dept: any) => sum + (dept.roi_multiplier || 0),
            0
        ) / (recommended_departments.length || 1);

        const projectedRevenue = totalMonthlyInvestment * avgROI;
        const breakEvenDays = Math.ceil((totalMonthlyInvestment / projectedRevenue) * 30);

        // Save to database
        const analysisId = crypto.randomUUID();

        await db
            .prepare(`
        INSERT INTO competitive_analysis (
          id, user_email, status,
          client_instagram_posts_week, client_instagram_likes_avg, client_instagram_engagement,
          client_facebook_posts_week, client_facebook_interactions_avg,
          client_google_rating, client_review_count,
          comp_instagram_posts_week_avg, comp_instagram_likes_avg_avg, comp_instagram_engagement_avg,
          comp_facebook_posts_week_avg, comp_facebook_interactions_avg_avg,
          gap_instagram_posts, gap_instagram_likes, gap_engagement, gap_facebook_posts,
          competitors_found, competitors_data, opportunities, recommended_departments,
          strengths, weaknesses,
          analysis_started_at, analysis_completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
            .bind(
                analysisId,
                session.user.email,
                'completed',
                client_social?.instagram?.posts_per_week || null,
                client_social?.instagram?.avg_likes || null,
                client_social?.instagram?.engagement_rate || null,
                client_social?.facebook?.posts_per_week || null,
                client_social?.facebook?.avg_reactions || null,
                geo_data?.client_location?.google_rating || null,
                geo_data?.client_location?.review_count || null,
                competitor_social?.averages?.instagram?.posts_per_week || null,
                competitor_social?.averages?.instagram?.avg_likes || null,
                competitor_social?.averages?.instagram?.engagement_rate || null,
                competitor_social?.averages?.facebook?.posts_per_week || null,
                competitor_social?.averages?.facebook?.avg_reactions || null,
                gaps.instagram_posts_gap,
                gaps.instagram_likes_gap,
                gaps.engagement_gap,
                gaps.facebook_posts_gap,
                geo_data?.total_found || 0,
                JSON.stringify(geo_data?.competitors || []),
                JSON.stringify(opportunities),
                JSON.stringify(recommended_departments),
                JSON.stringify(strengths),
                JSON.stringify(weaknesses),
                new Date().toISOString(),
                new Date().toISOString()
            )
            .run();

        return NextResponse.json({
            success: true,
            analysis_id: analysisId,
            comparison: gaps,
            strengths,
            weaknesses,
            opportunities,
            recommended_departments,
            financial_summary: {
                total_monthly_investment: totalMonthlyInvestment,
                projected_revenue_increase: `€${projectedRevenue.toFixed(0)}/mes`,
                avg_roi_multiplier: avgROI.toFixed(1) + 'x',
                break_even_days: breakEvenDays,
            },
        });
    } catch (error) {
        console.error("Consolidator error:", error);
        return NextResponse.json(
            { error: "Failed to consolidate analysis", details: String(error) },
            { status: 500 }
        );
    }
}

// Helper: Calculate gaps between client and competitors
function calculateGaps(clientSocial: any, competitorSocial: any, webData: any) {
    const gaps: any = {};

    // Instagram gaps
    if (clientSocial?.instagram && competitorSocial?.averages?.instagram) {
        const clientPosts = clientSocial.instagram.posts_per_week || 0;
        const compPosts = competitorSocial.averages.instagram.posts_per_week || 1;
        gaps.instagram_posts_gap = Math.round(((clientPosts - compPosts) / compPosts) * 100);

        const clientLikes = clientSocial.instagram.avg_likes || 0;
        const compLikes = competitorSocial.averages.instagram.avg_likes || 1;
        gaps.instagram_likes_gap = Math.round(((clientLikes - compLikes) / compLikes) * 100);

        const clientEng = clientSocial.instagram.engagement_rate || 0;
        const compEng = competitorSocial.averages.instagram.engagement_rate || 1;
        gaps.engagement_gap = Math.round(((clientEng - compEng) / compEng) * 100);
    }

    // Facebook gaps
    if (clientSocial?.facebook && competitorSocial?.averages?.facebook) {
        const clientFbPosts = clientSocial.facebook.posts_per_week || 0;
        const compFbPosts = competitorSocial.averages.facebook.posts_per_week || 1;
        gaps.facebook_posts_gap = Math.round(((clientFbPosts - compFbPosts) / compFbPosts) * 100);
    }

    // Pricing gap
    if (webData?.client?.pricing && webData?.averages?.pricing) {
        const clientPrice = webData.client.pricing.avg || 0;
        const compPrice = webData.averages.pricing.avg || 1;
        gaps.pricing_gap = Math.round(((clientPrice - compPrice) / compPrice) * 100);
    }

    return gaps;
}

// Helper: Identify strengths and weaknesses
function identifyStrengthsWeaknesses(gaps: any) {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    if (gaps.instagram_posts_gap < -30) weaknesses.push("Baja frecuencia de posts en Instagram (-" + Math.abs(gaps.instagram_posts_gap) + "%)");
    if (gaps.instagram_likes_gap < -30) weaknesses.push("Bajo engagement en Instagram (-" + Math.abs(gaps.instagram_likes_gap) + "%)");
    if (gaps.facebook_posts_gap < -30) weaknesses.push("Baja actividad en Facebook (-" + Math.abs(gaps.facebook_posts_gap) + "%)");

    if (gaps.pricing_gap > 10) strengths.push("Pricing premium (+" + gaps.pricing_gap + "% sobre promedio)");
    if (gaps.instagram_posts_gap > 0) strengths.push("Mayor frecuencia de posts que competencia");

    return { strengths, weaknesses };
}

// Helper: Generate opportunities
function generateOpportunities(gaps: any, weaknesses: string[]) {
    const opportunities: any[] = [];

    if (gaps.instagram_posts_gap < -30) {
        opportunities.push({
            id: "increase_posting",
            title: "Aumentar frecuencia de posts",
            impact: "high",
            description: "La competencia publica " + Math.abs(gaps.instagram_posts_gap) + "% más frecuente",
            metric_improvement: "Igualar frecuencia en 30 días",
        });
    }

    if (gaps.engagement_gap < -30) {
        opportunities.push({
            id: "boost_engagement",
            title: "Optimizar engagement",
            impact: "high",
            description: "Contenido interactivo puede duplicar engagement en 60 días",
            metric_improvement: "+100% engagement rate",
        });
    }

    return opportunities;
}

// Helper: Recommend departments
function recommendDepartments(opportunities: any[], gaps: any) {
    const departments: any[] = [];

    // Marketing Automation
    if (opportunities.some(o => o.id === 'increase_posting')) {
        departments.push({
            id: "marketing_automation",
            name: "Marketing Automation",
            price_monthly: 99,
            roi_multiplier: 4.2,
            estimated_time_to_roi: "60 días",
            benefits: [
                "Contenido automático 5 posts/semana",
                "Calendario inteligente",
                "Duplicar engagement en 60 días",
            ],
        });
    }

    // Social Media Manager
    if (gaps.engagement_gap < -30) {
        departments.push({
            id: "social_media_manager",
            name: "Social Media Manager IA",
            price_monthly: 149,
            roi_multiplier: 3.8,
            estimated_time_to_roi: "90 días",
            benefits: [
                "Análisis diario de competencia",
                "Respuestas automáticas 24/7",
                "Optimización de horarios",
            ],
        });
    }

    return departments;
}
