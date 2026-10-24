export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { requireTenantAccess, UnauthorizedError } from "@/lib/auth/session";

/**
 * Company Profile API — UPSERT for onboarding wizard
 *
 * POST: Save/update company profile (autosave per step)
 * GET:  Retrieve existing profile for current user
 */

interface ProfileBody {
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
    try {
        const { session } = await requireTenantAccess(req);
        const email = session.email?.trim().toLowerCase();
        if (!email) {
            return NextResponse.json({ error: "Session email required" }, { status: 400 });
        }

        const bindings = env();
        const db = bindings?.DRACO_DB;
        if (!db) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
        }

        const row = await db
            .prepare("SELECT * FROM company_profiles WHERE user_email = ?")
            .bind(email)
            .first<Record<string, unknown>>();

        if (!row) {
            return NextResponse.json({ profile: null });
        }

        const ctx = row.structured_context;
        return NextResponse.json({
            profile: {
                ...row,
                structured_context:
                    typeof ctx === "string" ? JSON.parse(ctx) : ctx ?? {},
            },
        });
    } catch (error) {
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[company-profile] GET error:", error);
        return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }
}

// POST — Save/update profile (autosave per step)
export async function POST(req: NextRequest) {
    try {
        const { session } = await requireTenantAccess(req);
        const userEmail = session.email?.trim().toLowerCase();
        if (!userEmail) {
            return NextResponse.json({ error: "Session email required" }, { status: 400 });
        }

        const bindings = env();
        const db = bindings?.DRACO_DB;
        if (!db) {
            return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
        }

        const body = (await req.json()) as ProfileBody;

        if (!body.companyName) {
            return NextResponse.json(
                { error: "Company name required" },
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
                userEmail,
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
        if (error instanceof UnauthorizedError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("[company-profile] POST error:", error);
        return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }
}
