import { NextResponse } from "next/server";
import {
    getStripeSetupTemplates,
    setupStripeForSaas,
    type StripeSetupConfig,
} from "@/lib/campamento-base/stripe-wizard/flow";

// export const runtime = "edge"; // OpenNext Migration

/**
 * GET /api/stripe/wizard/templates
 * Obtiene templates disponibles para setup
 */
export async function GET() {
    try {
        const templates = await getStripeSetupTemplates();
        return NextResponse.json({ templates });
    } catch (error) {
        console.error("STRIPE_TEMPLATES_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to fetch templates",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

/**
 * POST /api/stripe/wizard/setup
 * Ejecuta setup de Stripe para un SaaS
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const config = (await request.json()) as StripeSetupConfig;

        // Validar config
        if (!config.saasId || !config.saasName) {
            return NextResponse.json(
                { error: "Missing required fields: saasId, saasName" },
                { status: 400 },
            );
        }

        const result = await setupStripeForSaas(config, tenantId);

        if (result.status === "failed") {
            return NextResponse.json(
                {
                    error: "Stripe setup failed",
                    setupId: result.setupId,
                    message: result.error,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            setupId: result.setupId,
            stripeProductId: result.stripeProductId,
            stripePriceIds: result.stripePriceIds,
        });
    } catch (error) {
        console.error("STRIPE_SETUP_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to setup Stripe",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
