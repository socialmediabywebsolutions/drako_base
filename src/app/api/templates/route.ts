import { NextResponse } from "next/server";
import { getAllTemplates, getTemplate, deployTemplate, addTemplateReview } from "@/lib/campamento-base/templates/marketplace";

export const runtime = "edge";

/**
 * GET /api/templates
 * Lista todos los templates disponibles con filtros opcionales
 */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const vertical = url.searchParams.get("vertical");
    const tier = url.searchParams.get("tier");
    const featuredOnly = url.searchParams.get("featured") === "true";

    try {
        const templates = await getAllTemplates({
            vertical: vertical || undefined,
            tier: tier as "free" | "pro" | "enterprise" | undefined,
            featuredOnly,
        });

        return NextResponse.json({ templates, count: templates.length });
    } catch (error) {
        console.error("TEMPLATES_LIST_ERROR", error);
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
 * POST /api/templates/deploy
 * Despliega un template como nuevo SaaS
 */
export async function POST(request: Request) {
    const tenantId = request.headers.get("x-drako-tenant-id");

    if (!tenantId) {
        return NextResponse.json({ error: "Missing tenant context" }, { status: 400 });
    }

    try {
        const body = (await request.json()) as any;
        const { templateId, customization } = body;

        if (!templateId || !customization?.name || !customization?.slug) {
            return NextResponse.json(
                { error: "Missing required fields: templateId, customization.name, customization.slug" },
                { status: 400 },
            );
        }

        const result = await deployTemplate({
            templateId,
            tenantId,
            customization,
        });

        return NextResponse.json({
            success: true,
            saas: result,
        });
    } catch (error) {
        console.error("TEMPLATE_DEPLOY_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to deploy template",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
