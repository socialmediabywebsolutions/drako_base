import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST - Analyze competitors' social media and calculate averages
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { competitors } = body;

        if (!competitors || !Array.isArray(competitors)) {
            return NextResponse.json(
                { error: "Competitors array is required" },
                { status: 400 }
            );
        }

        // Analyze each competitor
        const competitorResults = await Promise.all(
            competitors.map(async (comp: any) => {
                const result: any = {
                    id: comp.id,
                    name: comp.name,
                    instagram: null,
                    facebook: null,
                };

                // Analyze Instagram if URL provided
                if (comp.instagram_url) {
                    try {
                        result.instagram = await analyzeInstagram(comp.instagram_url);
                    } catch (err) {
                        result.instagram = { error: String(err) };
                    }
                }

                // Analyze Facebook if URL provided
                if (comp.facebook_url) {
                    try {
                        result.facebook = await analyzeFacebook(comp.facebook_url);
                    } catch (err) {
                        result.facebook = { error: String(err) };
                    }
                }

                return result;
            })
        );

        // Calculate averages across all competitors
        const averages = calculateAverages(competitorResults);

        return NextResponse.json({
            success: true,
            competitors: competitorResults,
            averages,
            total_analyzed: competitorResults.length,
            analyzed_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Competitor-Social-Agent error:", error);
        return NextResponse.json(
            { error: "Failed to analyze competitors", details: String(error) },
            { status: 500 }
        );
    }
}

// Helper: Analyze Instagram (same as client-social)
async function analyzeInstagram(url: string) {
    const username = extractUsername(url, "instagram");

    // TODO: Implement actual scraping/API
    return {
        username,
        posts_per_week: null,
        avg_likes: null,
        engagement_rate: null,
        status: "pending_implementation",
    };
}

// Helper: Analyze Facebook (same as client-social)
async function analyzeFacebook(url: string) {
    const pageId = extractUsername(url, "facebook");

    return {
        page_id: pageId,
        posts_per_week: null,
        avg_reactions: null,
        engagement_rate: null,
        status: "pending_implementation",
    };
}

// Helper: Extract username/page ID
function extractUsername(url: string, platform: string): string | null {
    try {
        const pattern = platform === "instagram"
            ? /instagram\.com\/([^\/\?]+)/
            : /facebook\.com\/([^\/\?]+)/;
        const match = url.match(pattern);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

// Helper: Calculate averages
function calculateAverages(competitors: any[]) {
    const validCompetitors = competitors.filter(
        c => c.instagram && !c.instagram.error || c.facebook && !c.facebook.error
    );

    if (validCompetitors.length === 0) {
        return {
            instagram: null,
            facebook: null,
            note: "No valid data to calculate averages",
        };
    }

    // Calculate Instagram averages
    const igData = validCompetitors
        .map(c => c.instagram)
        .filter(ig => ig && !ig.error);

    const instagramAvg = igData.length > 0 ? {
        posts_per_week: average(igData.map(ig => ig.posts_per_week)),
        avg_likes: average(igData.map(ig => ig.avg_likes)),
        engagement_rate: average(igData.map(ig => ig.engagement_rate)),
    } : null;

    // Calculate Facebook averages
    const fbData = validCompetitors
        .map(c => c.facebook)
        .filter(fb => fb && !fb.error);

    const facebookAvg = fbData.length > 0 ? {
        posts_per_week: average(fbData.map(fb => fb.posts_per_week)),
        avg_reactions: average(fbData.map(fb => fb.avg_reactions)),
        engagement_rate: average(fbData.map(fb => fb.engagement_rate)),
    } : null;

    return {
        instagram: instagramAvg,
        facebook: facebookAvg,
        competitors_analyzed: validCompetitors.length,
    };
}

// Helper: Calculate average ignoring nulls
function average(values: (number | null)[]): number | null {
    const validValues = values.filter(v => v !== null) as number[];
    if (validValues.length === 0) return null;
    return Number((validValues.reduce((a, b) => a + b, 0) / validValues.length).toFixed(2));
}
