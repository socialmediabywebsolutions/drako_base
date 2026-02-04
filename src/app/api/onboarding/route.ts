import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { env } from "@/lib/cf";

// GET - Check if user completed onboarding
export async function GET(req: NextRequest) {
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
            .prepare("SELECT id, completed_at FROM client_onboarding WHERE user_email = ?")
            .bind(session.user.email)
            .first();

        return NextResponse.json({
            completed: !!result,
            data: result || null,
        });
    } catch (error) {
        console.error("Error checking onboarding:", error);
        return NextResponse.json({ error: "Failed to check onboarding" }, { status: 500 });
    }
}

// POST - Save onboarding data
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
        const body = await req.json();
        const {
            contactName,
            companyName,
            phone,
            address,
            latitude,
            longitude,
            sector,
            niche,
            websiteUrl,
            instagramUrl,
            facebookUrl,
            linkedinUrl,
            tiktokUrl,
            twitterUrl,
            problemStatement,
            targetCustomer,
            goals,
        } = body;

        // Validation
        if (!contactName || !companyName) {
            return NextResponse.json(
                { error: "Contact name and company name are required" },
                { status: 400 }
            );
        }

        const id = crypto.randomUUID();
        const goalsJson = JSON.stringify(goals || []);

        await db
            .prepare(
                `INSERT INTO client_onboarding (
          id, user_email, contact_name, company_name, phone,
          address, latitude, longitude, sector, niche,
          website_url, instagram_url, facebook_url, linkedin_url, tiktok_url, twitter_url,
          problem_statement, target_customer, goals
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_email) DO UPDATE SET
          contact_name = excluded.contact_name,
          company_name = excluded.company_name,
          phone = excluded.phone,
          address = excluded.address,
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          sector = excluded.sector,
          niche = excluded.niche,
          website_url = excluded.website_url,
          instagram_url = excluded.instagram_url,
          facebook_url = excluded.facebook_url,
          linkedin_url = excluded.linkedin_url,
          tiktok_url = excluded.tiktok_url,
          twitter_url = excluded.twitter_url,
          problem_statement = excluded.problem_statement,
          target_customer = excluded.target_customer,
          goals = excluded.goals,
          updated_at = CURRENT_TIMESTAMP`
            )
            .bind(
                id,
                session.user.email,
                contactName,
                companyName,
                phone || null,
                address || null,
                latitude || null,
                longitude || null,
                sector || null,
                niche || null,
                websiteUrl || null,
                instagramUrl || null,
                facebookUrl || null,
                linkedinUrl || null,
                tiktokUrl || null,
                twitterUrl || null,
                problemStatement || null,
                targetCustomer || null,
                goalsJson
            )
            .run();

        // Trigger competitive analysis in background (non-blocking)
        triggerCompetitiveAnalysis({
            userEmail: session.user.email,
            address,
            sector,
            instagramUrl,
            facebookUrl,
            linkedinUrl,
            websiteUrl,
        }).catch(err => {
            console.error("Failed to trigger competitive analysis:", err);
            // Don't fail the onboarding if analysis fails
        });

        return NextResponse.json({ success: true, id });
    } catch (error) {
        console.error("Error saving onboarding:", error);
        return NextResponse.json({ error: "Failed to save onboarding data" }, { status: 500 });
    }
}

// Helper: Trigger competitive analysis (async, non-blocking)
async function triggerCompetitiveAnalysis(data: {
    userEmail: string;
    address?: string;
    sector?: string;
    instagramUrl?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    websiteUrl?: string;
}) {
    // This would ideally use a queue system (Cloudflare Queues, etc.)
    // For now, we'll just call the geo agent as a starting point
    // In production, this should be a background job

    if (!data.address || !data.sector) {
        console.log("Skipping analysis: missing address or sector");
        return;
    }

    try {
        // Call Geo-Agent to start the analysis chain
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        await fetch(`${baseUrl}/api/analysis/geo?address=${encodeURIComponent(data.address)}&sector=${encodeURIComponent(data.sector)}&radius=5`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        console.log("Competitive analysis triggered for:", data.userEmail);
    } catch (err) {
        console.error("Error triggering analysis:", err);
    }
}
