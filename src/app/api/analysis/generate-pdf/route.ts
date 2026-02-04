import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/cf";
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { CompetitiveAnalysisReport } from "@/components/analysis/CompetitiveAnalysisReport";

// POST - Generate PDF from analysis data
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
        // Fetch analysis data from database
        const analysisData = await db
            .prepare(`
        SELECT 
          ca.*,
          co.company_name
        FROM competitive_analysis ca
        JOIN client_onboarding co ON ca.user_email = co.user_email
        WHERE ca.user_email = ?
        ORDER BY ca.created_at DESC
        LIMIT 1
      `)
            .bind(session.user.email)
            .first();

        if (!analysisData || analysisData.status !== 'completed') {
            return NextResponse.json(
                { error: "No completed analysis found" },
                { status: 404 }
            );
        }

        // Parse JSON fields
        const opportunities = analysisData.opportunities ? JSON.parse(analysisData.opportunities as string) : [];
        const departments = analysisData.recommended_departments ? JSON.parse(analysisData.recommended_departments as string) : [];
        const strengths = analysisData.strengths ? JSON.parse(analysisData.strengths as string) : [];
        const weaknesses = analysisData.weaknesses ? JSON.parse(analysisData.weaknesses as string) : [];

        // Calculate financial summary
        const totalInvestment = departments.reduce((sum: number, d: any) => sum + (d.price_monthly || 0), 0);
        const avgROI = departments.length > 0
            ? departments.reduce((sum: number, d: any) => sum + (d.roi_multiplier || 0), 0) / departments.length
            : 0;
        const projectedRevenue = totalInvestment * avgROI;
        const breakEven = totalInvestment > 0 ? Math.ceil((totalInvestment / projectedRevenue) * 30) : 0;

        // Prepare data for PDF
        const pdfData = {
            companyName: analysisData.company_name as string,
            analysis: {
                competitors_found: analysisData.competitors_found || 0,
                comparison: {
                    instagram_posts_gap: analysisData.gap_instagram_posts,
                    instagram_likes_gap: analysisData.gap_instagram_likes,
                    engagement_gap: analysisData.gap_engagement,
                    facebook_posts_gap: analysisData.gap_facebook_posts,
                    pricing_gap: analysisData.gap_pricing,
                },
                clientMetrics: {
                    instagram: {
                        posts_per_week: analysisData.client_instagram_posts_week,
                        avg_likes: analysisData.client_instagram_likes_avg,
                        engagement_rate: analysisData.client_instagram_engagement,
                    },
                    facebook: {
                        posts_per_week: analysisData.client_facebook_posts_week,
                        avg_reactions: analysisData.client_facebook_interactions_avg,
                    },
                    google_rating: analysisData.client_google_rating,
                    review_count: analysisData.client_review_count,
                },
                competitorMetrics: {
                    instagram: {
                        posts_per_week: analysisData.comp_instagram_posts_week_avg,
                        avg_likes: analysisData.comp_instagram_likes_avg_avg,
                        engagement_rate: analysisData.comp_instagram_engagement_avg,
                    },
                    facebook: {
                        posts_per_week: analysisData.comp_facebook_posts_week_avg,
                        avg_reactions: analysisData.comp_facebook_interactions_avg_avg,
                    },
                    google_rating: analysisData.comp_google_rating_avg,
                    review_count: analysisData.comp_review_count_avg,
                },
                strengths,
                weaknesses,
                opportunities,
                recommended_departments: departments,
                financial_summary: {
                    total_monthly_investment: totalInvestment,
                    projected_revenue_increase: `€${projectedRevenue.toFixed(0)}/mes`,
                    avg_roi_multiplier: avgROI.toFixed(1) + 'x',
                    break_even_days: breakEven,
                },
            },
        };

        // Generate PDF
        const pdfBuffer = await renderToBuffer(
            React.createElement(CompetitiveAnalysisReport, pdfData)
        );

        // TODO: Upload to Cloudflare R2
        // For now, return the PDF directly

        const pdfFileName = `analisis_competitivo_${analysisData.company_name?.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

        // Update database with PDF URL (placeholder for now)
        await db
            .prepare(`
        UPDATE competitive_analysis
        SET pdf_url = ?, pdf_generated_at = ?
        WHERE user_email = ?
      `)
            .bind(
                `/temp/${pdfFileName}`,  // Placeholder until R2 upload
                new Date().toISOString(),
                session.user.email
            )
            .run();

        // Return PDF as download
        return new NextResponse(pdfBuffer, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${pdfFileName}"`,
            },
        });
    } catch (error) {
        console.error("PDF generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate PDF", details: String(error) },
            { status: 500 }
        );
    }
}
