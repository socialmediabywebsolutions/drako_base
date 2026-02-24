export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/crypto";
import { env } from "@/lib/cf";

export async function POST(req: Request) {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();

    try {
        const body = (await req.json()) as { email?: string; password?: string; name?: string };
        const { email, password, name } = body;

        // 1. Basic Validation
        if (!email || !password) {
            return NextResponse.json(
                { error: "MISSING_FIELDS" },
                { status: 400 }
            );
        }

        const conf = env();
        if (!conf || !conf.DRACO_DB) {
            console.error("REGISTER_ERROR: DB binding missing", { requestId });
            return NextResponse.json(
                { error: "SERVICE_UNAVAILABLE" },
                { status: 503 }
            );
        }

        const db = conf.DRACO_DB;
        const normalizedEmail = email.trim().toLowerCase();

        // 2. Check if user already exists
        const existing = await db.prepare(
            "SELECT id FROM auth_users WHERE email = ? LIMIT 1"
        ).bind(normalizedEmail).first();

        if (existing) {
            return NextResponse.json(
                { error: "EMAIL_EXISTS" },
                { status: 409 }
            );
        }

        // 3. Hash Password
        const { hash, salt, iterations } = await hashPassword(password);
        const userId = crypto.randomUUID();
        const credId = crypto.randomUUID();
        const now = new Date().toISOString();

        // 4. Atomic Registration (Batch)
        await db.batch([
            db.prepare(
                "INSERT INTO auth_users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(userId, normalizedEmail, name || "User", now, now),
            db.prepare(
                "INSERT INTO auth_credentials (id, user_id, type, hash, salt, iterations, algo, created_at) VALUES (?, ?, 'email', ?, ?, ?, 'PBKDF2-SHA256', ?)"
            ).bind(credId, userId, hash, salt, iterations, now)
        ]);

        console.info("REGISTER_SUCCESS", {
            requestId,
            userId,
            durationMs: Date.now() - startTime
        });

        return NextResponse.json({
            success: true,
            user: { id: userId, email: normalizedEmail, name: name }
        }, { status: 201 });

    } catch (error: any) {
        console.error("REGISTER_CRITICAL_FAILURE", {
            requestId,
            error: error.message,
            stack: error.stack,
            durationMs: Date.now() - startTime
        });

        return NextResponse.json(
            { error: "INTERNAL_SERVER_ERROR", requestId },
            { status: 500 }
        );
    }
}
