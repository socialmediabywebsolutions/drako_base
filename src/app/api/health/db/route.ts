import { NextResponse } from "next/server";
import { ensureDatabase, queryOne, DatabaseUnavailableError } from "@/lib/db";

export const runtime = "edge";

/**
 * Health Check para D1 Database
 * ==============================
 * Verifica connectivity a D1 y estado de migraciones
 */
export async function GET() {
    const timestamp = new Date().toISOString();

    try {
        // 1. Verificar binding
        ensureDatabase();

        // 2. Test query simple
        const pingResult = await queryOne<{ result: number }>("SELECT 1 as result");
        if (!pingResult || pingResult.result !== 1) {
            throw new Error("Ping query failed");
        }

        // 3. Verificar tablas críticas
        const criticalTables = [
            "tenants",
            "companies",
            "saas_projects",
            "project_entitlements",
            "saas_domains",
            "stripe_mapping",
        ];

        const missingTables: string[] = [];
        for (const table of criticalTables) {
            const exists = await queryOne<{ name: string }>(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
                table,
            );
            if (!exists) {
                missingTables.push(table);
            }
        }

        // 4. Verificar estado de migraciones (si existe tabla)
        let migrationsCount = 0;
        try {
            const migrationsTable = await queryOne<{ name: string }>(
                "SELECT name FROM sqlite_master WHERE type='table' AND name = 'd1_migrations'",
            );
            if (migrationsTable) {
                const result = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM d1_migrations");
                migrationsCount = result?.count ?? 0;
            }
        } catch {
            // Ignorar si no existe tabla de migraciones
        }

        if (missingTables.length > 0) {
            return NextResponse.json(
                {
                    status: "degraded",
                    timestamp,
                    connectivity: "ok",
                    binding: "ok",
                    migrations: {
                        applied: migrationsCount,
                        status: "incomplete",
                    },
                    schema: {
                        status: "incomplete",
                        missingTables,
                    },
                    message: `Database connected but missing ${missingTables.length} critical tables. Run migrations.`,
                },
                { status: 200 },
            );
        }

        return NextResponse.json(
            {
                status: "healthy",
                timestamp,
                connectivity: "ok",
                binding: "ok",
                migrations: {
                    applied: migrationsCount,
                    status: "ok",
                },
                schema: {
                    status: "ok",
                    tablesChecked: criticalTables.length,
                },
            },
            { status: 200 },
        );
    } catch (error) {
        const isDatabaseError = error instanceof DatabaseUnavailableError;
        const reason = isDatabaseError ? error.reason : "unknown";
        const message = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                status: "unhealthy",
                timestamp,
                connectivity: "failed",
                binding: isDatabaseError && reason === "binding-missing" ? "missing" : "unknown",
                error: {
                    type: isDatabaseError ? "DatabaseUnavailableError" : "Error",
                    reason,
                    message,
                },
                hint:
                    reason === "binding-missing"
                        ? "Configure D1 binding 'DRACO_DB' in Cloudflare Pages project settings"
                        : "Check D1 database connectivity and migrations",
            },
            { status: 503 },
        );
    }
}
