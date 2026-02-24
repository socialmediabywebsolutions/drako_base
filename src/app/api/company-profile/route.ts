export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/cf";

/**
 * Company Profile API — UPSERT for onboarding wizard
 *
 * POST: Save/update company profile (autosave per step)
 * GET:  Retrieve existing profile for current user
 */

interface ProfileBody {
    userEmail: string;
    companyName: string;
    sector?: string;
    address?: string;
    zone?: string;
    currentStep?: number;
    structuredContext?: Record<string, unknown>;
    completed?: boolean;
}

// GET — Load existing profile
export async function GET(req: NextRequest) {
    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
        return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    try {
        const row = await db
            .prepare("SELECT * FROM company_profiles WHERE user_email = ?")
            .bind(email)
            .first();

        if (!row) {
            return NextResponse.json({ profile: null });
        }

        return NextResponse.json({
            profile: {
                ...row,
                structured_context:
                    typeof row.structured_context === "string"
                        ? JSON.parse(row.structured_context as string)
                        : row.structured_context ?? {},
            },
        });
    } catch (error) {
        console.error("[company-profile] GET error:", error);
        return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }
}

// POST — Save/update profile (autosave per step)
export async function POST(req: NextRequest) {
    const bindings = env();
    const db = bindings?.DRACO_DB;
    if (!db) {
        return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    try {
        const body = (await req.json()) as ProfileBody;

        if (!body.userEmail || !body.companyName) {
            return NextResponse.json(
                { error: "Email and company name required" },
                { status: 400 }
            );
        }

        const id = crypto.randomUUID();
        const contextJson = JSON.stringify(body.structuredContext ?? {});
        const completedAt = body.completed
            ? new Date().toISOString()
            : null;

        await db
            .prepare(
                `INSERT INTO company_profiles (
          id, user_email, company_name, sector, address, zone,
          structured_context, current_step, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_email) DO UPDATE SET
          company_name = excluded.company_name,
          sector = excluded.sector,
          address = excluded.address,
          zone = excluded.zone,
          structured_context = excluded.structured_context,
          current_step = excluded.current_step,
          completed_at = COALESCE(excluded.completed_at, company_profiles.completed_at)`
            )
            .bind(
                id,
                body.userEmail,
                body.companyName,
                body.sector ?? null,
                body.address ?? null,
                body.zone ?? null,
                contextJson,
                body.currentStep ?? 1,
                completedAt
            )
            .run();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[company-profile] POST error:", error);
        return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }
}
