import { NextResponse } from "next/server";
import { env } from "@/lib/cf";
import { runAi } from "@/lib/ai/client";

// export const runtime = "edge"; // OpenNext Migration

/**
 * Health Check para Workers AI
 * =============================
 * Verifica que el binding AI esté disponible y funcional
 */
export async function GET() {
    const timestamp = new Date().toISOString();
    const bindings = env();

    if (!bindings) {
        return NextResponse.json(
            {
                status: "unhealthy",
                timestamp,
                binding: "unavailable",
                reason: "No request context (not running on Cloudflare)",
            },
            { status: 503 },
        );
    }

    // Verificar binding AI
    const hasAiBinding = Boolean((bindings as unknown as { AI?: unknown }).AI);

    if (!hasAiBinding) {
        return NextResponse.json(
            {
                status: "unhealthy",
                timestamp,
                binding: "missing",
                reason: "AI binding not configured",
                hint: "Add [ai] binding = 'AI' to wrangler.toml",
                gateway: {
                    configured: Boolean(bindings.AI_GATEWAY_ID),
                    accountId: Boolean(bindings.CF_ACCOUNT_ID),
                },
            },
            { status: 503 },
        );
    }

    // Test simple de AI (ping)
    try {
        const startTime = Date.now();
        const result = await runAi({
            messages: [{ role: "user", content: "ping" }],
            tenantId: "health-check",
            mode: "fast",
            cache: false,
        });
        const duration = Date.now() - startTime;

        if (!result.ok) {
            return NextResponse.json(
                {
                    status: "degraded",
                    timestamp,
                    binding: "ok",
                    inference: "failed",
                    model: result.model,
                    provider: result.provider,
                    duration,
                    reason: "AI inference failed",
                },
                { status: 200 },
            );
        }

        return NextResponse.json(
            {
                status: "healthy",
                timestamp,
                binding: "ok",
                inference: "ok",
                model: result.model,
                provider: result.provider,
                duration,
                gateway: {
                    configured: Boolean(bindings.AI_GATEWAY_ID),
                    accountId: Boolean(bindings.CF_ACCOUNT_ID),
                },
            },
            { status: 200 },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        return NextResponse.json(
            {
                status: "unhealthy",
                timestamp,
                binding: "ok",
                inference: "error",
                error: {
                    message,
                },
                hint: "Check AI Gateway configuration and model availability",
            },
            { status: 503 },
        );
    }
}
