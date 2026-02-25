export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/crypto";
import { env } from "@/lib/cf";
import { ensureDatabase } from "@/lib/db";

/**
 * OPERACIÓN OLIMPO: Registro Definitivo (Tabula Rasa)
 * --------------------------------------------------
 * - 0 Proxies externos.
 * - 1 Lectura de req.json().
 * - Logs JSON atómicos con correlationId.
 * - Hashing WebCrypto a 100k iteraciones.
 * - Integridad de tablas D1 verificada.
 */
export async function POST(req: Request) {
    const startTime = Date.now();
    const correlationId = req.headers.get("x-correlation-id") || crypto.randomUUID();

    console.log(JSON.stringify({
        event: "AUTH_REGISTER_START",
        correlationId,
        method: req.method,
        url: req.url
    }));

    try {
        // 1. FASE 1: Recepción de datos (Lectura ÚNICA)
        let body: any;
        try {
            body = await req.json();
        } catch (e) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "INVALID_JSON" }));
            return NextResponse.json(
                { ok: false, code: "INVALID_INPUT", message: "Formato JSON inválido.", correlationId },
                { status: 400 }
            );
        }

        const { email, password, name } = body;

        // 2. FASE 2: Validación
        if (!email || !password) {
            console.warn(JSON.stringify({ event: "AUTH_REGISTER_VALIDATE_FAIL", correlationId, missing: { email: !email, password: !password } }));
            return NextResponse.json(
                { ok: false, code: "INVALID_INPUT", message: "Email y contraseña son obligatorios.", correlationId },
                { status: 400 }
            );
        }

        const cleanEmail = email.trim().toLowerCase();
        if (password.length < 8) {
            return NextResponse.json(
                { ok: false, code: "INVALID_INPUT", message: "La contraseña debe tener al menos 8 caracteres.", correlationId },
                { status: 400 }
            );
        }

        // 3. FASE 3: Conectividad D1
        const cloudflareEnv = env();
        const db = cloudflareEnv?.DRACO_DB;
        if (!db) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "D1_BINDING_MISSING" }));
            return NextResponse.json(
                { ok: false, code: "D1_BINDING_MISSING", message: "Error interno: El binding de base de datos no está configurado.", correlationId },
                { status: 503 }
            );
        }

        try {
            await ensureDatabase();
        } catch (e: any) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "DB_INIT_FAIL", error: e.message }));
            return NextResponse.json(
                { ok: false, code: "DB_ERROR", message: "Error al inicializar la base de datos.", correlationId },
                { status: 503 }
            );
        }

        // 4. FASE 4: Integridad de tablas
        const tableCheck = await db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('auth_users', 'auth_credentials')"
        ).all();
        const foundTables = tableCheck.results?.map((r: any) => r.name) || [];

        if (foundTables.length < 2) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "DB_NOT_READY", foundTables }));
            return NextResponse.json(
                { ok: false, code: "DB_NOT_READY", message: "Estructura de base de datos incompleta.", correlationId },
                { status: 503 }
            );
        }

        // 5. FASE 5: Comprobar duplicado
        const existing = await db.prepare("SELECT id FROM auth_users WHERE email = ?").bind(cleanEmail).first();
        if (existing) {
            console.warn(JSON.stringify({ event: "AUTH_REGISTER_VALIDATE_FAIL", correlationId, code: "EMAIL_EXISTS", email: cleanEmail }));
            return NextResponse.json(
                { ok: false, code: "EMAIL_EXISTS", message: "Este email ya está registrado.", correlationId },
                { status: 409 }
            );
        }

        // 6. FASE 6: Hashing
        const hashStart = Date.now();
        console.log(JSON.stringify({ event: "AUTH_REGISTER_HASH_START", correlationId }));
        let secure;
        try {
            secure = await hashPassword(password);
            const hashDuration = Date.now() - hashStart;
            console.log(JSON.stringify({
                event: "AUTH_REGISTER_HASH_OK",
                correlationId,
                durationMs: hashDuration,
                iterations: secure.iterations
            }));
        } catch (e: any) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "HASHING_ERROR", error: e.name }));
            return NextResponse.json(
                { ok: false, code: "HASHING_ERROR", message: "Error al procesar la seguridad de la contraseña.", correlationId },
                { status: 500 }
            );
        }

        // 7. FASE 7: Inserción Atómica
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();

        try {
            await db.batch([
                db.prepare(
                    "INSERT INTO auth_users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
                ).bind(userId, cleanEmail, name || null, now, now),
                db.prepare(
                    "INSERT INTO auth_credentials (id, user_id, type, value, salt, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
                ).bind(crypto.randomUUID(), userId, "password", secure.hash, secure.salt, secure.iterations, now)
            ]);

            console.log(JSON.stringify({ event: "AUTH_REGISTER_DB_OK", correlationId, userId }));
        } catch (e: any) {
            console.error(JSON.stringify({ event: "AUTH_REGISTER_ERROR", correlationId, code: "DB_WRITE_ERROR", error: e.message }));
            return NextResponse.json(
                { ok: false, code: "DB_ERROR", message: "No se pudo crear la cuenta de usuario.", correlationId },
                { status: 500 }
            );
        }

        // 8. FASE 8: Éxito Final
        const totalDuration = Date.now() - startTime;
        console.log(JSON.stringify({
            event: "AUTH_REGISTER_OK",
            correlationId,
            durationMs: totalDuration,
            userId
        }));

        return NextResponse.json({
            ok: true,
            user: { id: userId, email: cleanEmail, name },
            correlationId
        }, { status: 201 });

    } catch (e: any) {
        console.error(JSON.stringify({
            event: "AUTH_REGISTER_ERROR",
            correlationId,
            code: "INTERNAL_SERVER_ERROR",
            error: e.message
        }));
        return NextResponse.json(
            { ok: false, code: "INTERNAL_SERVER_ERROR", message: "Error inesperado en el servidor.", correlationId },
            { status: 500 }
        );
    }
}
