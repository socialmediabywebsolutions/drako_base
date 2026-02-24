export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/campamento-base/templates/marketplace";



/**
 * GET /api/templates/[slug]
 * Obtiene detalles de un template específico
 */
export async function GET(request: Request, props: { params: Promise<{ slug: string }> }) {
    const params = await props.params;
    const slug = params.slug;

    try {
        const template = await getTemplate(slug);

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        return NextResponse.json({ template });
    } catch (error) {
        console.error("TEMPLATE_GET_ERROR", error);
        return NextResponse.json(
            {
                error: "Failed to fetch template",
                message: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
