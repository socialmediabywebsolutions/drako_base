export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/crypto";
import { env } from "@/lib/cf";
import { ensureDatabase } from "@/lib/db";

/**
 * OPERACIÓN OLIMPO: Registro Definitivo
 * - Sin proxies externos.
 * - Lectura de body UNA sola vez.
 * - Logs JSON atómicos.
 * - Hashing WebCrypto.
 */
export async function POST(req: Request) {
    const incomingCorrelationId = req.headers.get("x-correlation-id");
    const correlationId = incomingCorrelationId || crypto.randomUUID();
    const startTime = Date.now();
    const host = req.headers.get("host") || "unknown";

    // 1. Log START (JSON)
    console.log(JSON.stringify({
        event: "AUTH_REGISTER_START",
        correlationId,
        host,
        url: req.url,
        method: req.method
    }));

    // 2. Fail-Safe Database Check (Early)
    let db;
    try {
        const bindings = env();
        if (!bindings?.DRACO_DB) {
            throw new Error("D1_BINDING_MISSING");
        }
        db = ensureDatabase();
    } catch (e) {
        console.error(JSON.stringify({
            event: "AUTH_REGISTER_ERROR",
            correlationId,
            code: "D1_BINDING_MISSING",
            error: e instanceof Error ? e.message : String(e)
        }));
        return NextResponse.json(
            {
                ok: false,
                code: "D1_BINDING_MISSING",
                message: "El sistema está iniciando. Reintenta en unos segundos.",
                correlationId
            },
            { status: 503 }
        );
    }

    try {
        // 3. Parse Body (EXACTAMENTE UNA VEZ)
        let body;
        try {
            body = (await req.json()) as { email?: string; password?: string; name?: string };
        } catch (e) {
            console.warn(JSON.stringify({ event: "AUTH_REGISTER_VALIDATE_FAIL", correlationId, reason: "INVALID_JSON" }));
            return NextResponse.json(
                { ok: false, code: "INVALID_INPUT", message: "Formato de datos inválido.", correlationId },
                { status: 400 }
            );
        }

        const { email, password, name } = body;

        // 4. Validation
        if (!email || !password) {
            console.warn(JSON.stringify({ event: "AUTH_REGISTER_VALIDATE_FAIL", correlationId, reason: "MISSING_FIELDS" }));
            return NextResponse.json(
                { ok: false, code: "INVALID_INPUT", message: "Email y contraseña son obligatorios.", correlationId },
                { status: 400 }
            );
        }

        const normalizedEmail = email.trim().toLowerCase();
        console.log(JSON.stringify({ event: "AUTH_REGISTER_VALIDATE_OK", correlationId, email: normalizedEmail }));

        // 5. FASE 3: Integrity Check (Existence of tables)
        console.log(JSON.stringify({ event: "AUTH_REGISTER_D1_CHECK", correlationId }));
        try {
            const tableCheck = await db.prepare(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('auth_users', 'auth_credentials')"
            ).all();

            const foundTables = tableCheck.results?.map((r: any) => r.name) || [];

            if (!foundTables.includes('auth_users') || !foundTables.includes('auth_credentials')) {
                console.error(JSON.stringify({
                    event: "AUTH_REGISTER_ERROR",
                    correlationId,
                    code: "DB_NOT_READY",
                    foundTables
                }));
                return NextResponse.json(
                    {
                        ok: false,
                        code: "DB_NOT_READY",
                        message: "La base de datos aún no está preparada (faltan tablas de acceso).",
                        correlationId
                    },
                    { status: 503 }
                );
            }
        } catch (e: any) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "DB_ERROR", error: e.message }));
            return NextResponse.json(
                { ok: false, code: "DB_ERROR", message: "Error al verificar la integridad de la base de datos.", correlationId },
                { status: 500 }
            );
        }

        // 6. Check duplicate
        const existing = await db.prepare(
            "SELECT id FROM auth_users WHERE email = ? LIMIT 1"
        ).bind(normalizedEmail).first();

        if (existing) {
            console.warn(JSON.stringify({ event: "AUTH_REGISTER_VALIDATE_FAIL", correlationId, reason: "EMAIL_EXISTS" }));
            return NextResponse.json(
                { ok: false, code: "EMAIL_EXISTS", message: "Este correo ya está registrado.", correlationId },
                { status: 409 }
            );
        }

        // 7. Hash Password (WebCrypto)
        let hashedPassword;
        try {
            hashedPassword = await hashPassword(password);
        } catch (error: any) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "HASHING_ERROR", error: error.message }));
            return NextResponse.json(
                { ok: false, code: "HASHING_ERROR", message: "Error al procesar la seguridad de la contraseña.", correlationId },
                { status: 500 }
            );
        }

        const userId = crypto.randomUUID();
        const credId = crypto.randomUUID();
        const now = new Date().toISOString();

        // 8. Atomic Insert (Only auth tables)
        await db.batch([
            db.prepare(
                "INSERT INTO auth_users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
            ).bind(userId, normalizedEmail, name || "Usuario", now, now),
            db.prepare(
                "INSERT INTO auth_credentials (id, user_id, type, hash, salt, iterations, algo, created_at) VALUES (?, ?, 'email', ?, ?, ?, 'PBKDF2-SHA256', ?)"
            ).bind(credId, userId, hashedPassword.hash, hashedPassword.salt, hashedPassword.iterations, now)
        ]);

        console.log(JSON.stringify({
            event: "AUTH_REGISTER_DB_OK",
            correlationId,
            userId,
            durationMs: Date.now() - startTime
        }));

        console.log(JSON.stringify({
            event: "AUTH_REGISTER_OK",
            correlationId,
            userId,
            durationMs: Date.now() - startTime
        }));

        return NextResponse.json({
            ok: true,
            success: true,
            user: { id: userId, email: normalizedEmail, name: name },
            correlationId
        }, { status: 201 });

    } catch (error: any) {
        console.error(JSON.stringify({
            event: "AUTH_REGISTER_ERROR",
            correlationId,
            code: "INTERNAL_SERVER_ERROR",
            error: error.message,
            stack: error.stack,
            durationMs: Date.now() - startTime
        }));

        return NextResponse.json(
            {
                ok: false,
                code: "INTERNAL_SERVER_ERROR",
                message: "Error interno del sistema. Reintenta o contacta soporte.",
                correlationId
            },
            { status: 500 }
        );
    }
}
