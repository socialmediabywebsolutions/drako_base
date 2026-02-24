export const dynamic = "force-dynamic";


import { NextResponse } from "next/server";
import { safeEnv, type DrakoStrictEnv } from "@/lib/env";

export const runtime = "nodejs"; // Strict Requirement: Node runtime for secure env access

/**
 * 🔒 ENV DOCTOR (Internal Only)
 * 
 * Confirm variables safely without leaking values.
 * FAIL-CLOSED: 404 if INTERNAL_API_SECRET is missing.
 * CACHE-CONTROL: no-store.
 */
export async function GET(req: Request) {
    // 1. FAIL-CLOSED: If server isn't configured with internal secret, pretend endpoint doesn't exist.
    // This prevents accidental exposure on misconfigured environments.
    if (!safeEnv.INTERNAL_API_SECRET) {
        return new NextResponse(null, { status: 404 });
    }

    // 2. AUTH CHECK
    const secretHeader = req.headers.get("X-Drako-Origin-Secret");
    if (secretHeader !== safeEnv.INTERNAL_API_SECRET) {
        return new NextResponse(null, { status: 403 });
    }

    // 3. DIAGNOSTICS (Boolean only)
    // We check safeEnv properties which throw if missing, but here we want to just check presence safely
    // Since safeEnv getters throw, we'll use a try/catch strategy for each or inspect process.env directly?
    // Actually, safeEnv is designed to throw. Let's use a helper that doesn't throw for this doctor check.

    // Re-implementing a safe check here since safeEnv is strict.
    const check = (key: string) => {
        const val = process.env[key];
        return !!(val && val.length > 0);
    };

    const status = {
        // Identity
        NODE_ENV: process.env.NODE_ENV,

        // Critical Infrastructure
        DRACO_DB: check("DRACO_DB"), // Note: Might be binding in Workers, check via context if needed but this is Node runtime

        // Auth
        NEXTAUTH_URL: check("NEXTAUTH_URL"),
        NEXTAUTH_SECRET: check("NEXTAUTH_SECRET"),
        GOOGLE_CLIENT_ID: check("GOOGLE_CLIENT_ID"),
        GOOGLE_CLIENT_SECRET: check("GOOGLE_CLIENT_SECRET"),
        INTERNAL_API_SECRET: check("INTERNAL_API_SECRET"),

        // Payments
        STRIPE_SECRET_KEY: check("STRIPE_SECRET_KEY"),
        STRIPE_WEBHOOK_SECRET: check("STRIPE_WEBHOOK_SECRET"),

        // AI
        FIREWORKS_API_KEY: check("FIREWORKS_API_KEY"),
    };

    return NextResponse.json(status, {
        status: 200,
        headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    });
}
