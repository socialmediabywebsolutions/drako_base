export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// POST - Scrape websites for pricing and services
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json() as { client_website?: string; competitor_websites?: string[] };
        const { client_website, competitor_websites } = body;

        const results: any = {
            client: null,
            competitors: [],
            averages: null,
        };

        // Analyze client website
        if (client_website) {
            try {
                results.client = await analyzeWebsite(client_website);
            } catch (err) {
                results.client = { error: String(err) };
            }
        }

        // Analyze competitor websites
        if (competitor_websites && Array.isArray(competitor_websites)) {
            results.competitors = await Promise.all(
                competitor_websites.map(async (url: string) => {
                    try {
                        return await analyzeWebsite(url);
                    } catch (err) {
                        return { url, error: String(err) };
                    }
                })
            );
        }

        // Calculate competitor averages
        results.averages = calculateWebAverages(results.competitors);

        return NextResponse.json({
            success: true,
            data: results,
            analyzed_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Web-Agent error:", error);
        return NextResponse.json(
            { error: "Failed to analyze websites", details: String(error) },
            { status: 500 }
        );
    }
}

// Helper: Analyze a single website
async function analyzeWebsite(url: string) {
    // In production, this would use a web scraping library like Puppeteer or Cheerio
    // For now, return structure

    try {
        // Basic fetch to check if site is accessible
        const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
        });

        const isAccessible = response.ok;

        return {
            url,
            accessible: isAccessible,
            pricing: {
                min: null,
                max: null,
                avg: null,
                currency: "EUR",
                note: "Pricing extraction pending implementation"
            },
            services: [],  // Would extract from h2, h3, lists
            seo_keywords: [],  // Would extract from meta tags, h1, h2
            has_contact_form: null,
            has_chat: null,
            load_time_ms: null,
            status: "pending_full_implementation",
        };
    } catch (err) {
        return {
            url,
            accessible: false,
            error: String(err),
        };
    }
}

// Helper: Calculate averages from competitor websites
function calculateWebAverages(competitors: any[]) {
    const validSites = competitors.filter(c => c.accessible && !c.error);

    if (validSites.length === 0) {
        return {
            pricing: null,
            common_services: [],
            top_keywords: [],
            note: "No valid competitor websites for averaging"
        };
    }

    // Extract all prices
    const allPrices = validSites
        .flatMap(site => [site.pricing?.min, site.pricing?.max])
        .filter(p => p !== null && p !== undefined) as number[];

    const pricingAvg = allPrices.length > 0 ? {
        min: Math.min(...allPrices),
        max: Math.max(...allPrices),
        avg: Number((allPrices.reduce((a, b) => a + b, 0) / allPrices.length).toFixed(2)),
        currency: "EUR",
    } : null;

    // Aggregate services
    const allServices = validSites.flatMap(site => site.services || []);
    const serviceCounts = allServices.reduce((acc: any, service: string) => {
        acc[service] = (acc[service] || 0) + 1;
        return acc;
    }, {});

    const commonServices = Object.entries(serviceCounts)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 10)
        .map(([service]) => service);

    // Aggregate keywords
    const allKeywords = validSites.flatMap(site => site.seo_keywords || []);
    const keywordCounts = allKeywords.reduce((acc: any, keyword: string) => {
        acc[keyword] = (acc[keyword] || 0) + 1;
        return acc;
    }, {});

    const topKeywords = Object.entries(keywordCounts)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 10)
        .map(([keyword]) => keyword);

    return {
        pricing: pricingAvg,
        common_services: commonServices,
        top_keywords: topKeywords,
        sites_analyzed: validSites.length,
    };
}
